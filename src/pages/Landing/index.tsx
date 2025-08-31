import React, { useState, useEffect } from 'react';
import { landingPageApi, LandingPage, API_BASE_URL } from '../../lib/api';

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ddmmhh = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

// Componente de Modal de Edição
interface EditLandingPageModalProps {
  landingPage: LandingPage;
  onClose: () => void;
  onSave: (updatedLandingPage: LandingPage) => void;
}

function EditLandingPageModal({ landingPage, onClose, onSave }: EditLandingPageModalProps) {
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(landingPage.imageUrl ?? null);
  const [productTitle, setProductTitle] = useState(landingPage.productTitle);
  const [productDescription, setProductDescription] = useState(landingPage.productDescription);
  const [productBrand, setProductBrand] = useState(landingPage.productBrand);
  const [productPrice, setProductPrice] = useState<number | ''>(landingPage.productPrice);
  const [shippingValue, setShippingValue] = useState<number | ''>(landingPage.shippingValue);
  const [freeShipping, setFreeShipping] = useState(landingPage.freeShipping);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para validação inline
  const [titleError, setTitleError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setProductImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
      setProductImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  } else {
    setProductImageFile(null);
    setProductImagePreview(landingPage.imageUrl ?? null);
  }
};

  const validateForm = () => {
    let isValid = true;
    setTitleError(null);
    setPriceError(null);
    setBrandError(null);
    setShippingError(null);

    if (!productTitle.trim()) {
      setTitleError("O título do produto é obrigatório.");
      isValid = false;
    }
    if (productPrice === '' || isNaN(Number(productPrice)) || Number(productPrice) <= 0) {
      setPriceError("O preço do produto é obrigatório e deve ser um número positivo.");
      isValid = false;
    }
    if (!productBrand.trim()) {
      setBrandError("A marca do produto é obrigatória.");
      isValid = false;
    }
    if (!freeShipping && (shippingValue === '' || isNaN(Number(shippingValue)) || Number(shippingValue) < 0)) {
      setShippingError("O valor do frete é obrigatório e deve ser um número não negativo quando o frete grátis não está marcado.");
      isValid = false;
    }

    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setError("Por favor, preencha todos os campos obrigatórios corretamente.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updatedData = {
        image: productImageFile || undefined,
        productTitle,
        productDescription,
        productBrand,
        productPrice: Number(productPrice),
        shippingValue: freeShipping ? 0 : Number(shippingValue),
        freeShipping,
      };
      const result = await landingPageApi.updateLandingPage(landingPage.id, updatedData);
      onSave(result);
      onClose();
    } catch (err: any) {
      console.error("Erro ao atualizar landing page:", err);
      setError(err.message || "Falha ao atualizar landing page.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-xl font-bold text-emerald-900 mb-4">Editar Landing Page</h2>
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="editProductImage" className="block text-sm font-medium text-zinc-700">Foto do produto</label>
            <input
              type="file"
              id="editProductImage"
              accept="image/*"
              onChange={handleImageUpload}
              className="mt-1 block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
            {productImagePreview && (
              <img
                src={productImagePreview}
                alt="Pré-visualização do produto"
                className="mt-2 max-h-40 object-cover rounded-md"
              />
            )}
          </div>
          <div>
            <label htmlFor="editProductTitle" className="block text-sm font-medium text-zinc-700">Título do produto</label>
            <input
              type="text"
              id="editProductTitle"
              value={productTitle}
              onChange={(e) => { setProductTitle(e.target.value); setTitleError(null); }}
              className={`mt-1 block w-full border ${titleError ? 'border-red-500' : 'border-zinc-300'} rounded-md shadow-sm p-2`}
            />
            {titleError && <p className="text-red-500 text-xs mt-1">{titleError}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="editProductDescription" className="block text-sm font-medium text-zinc-700">Descrição do produto</label>
            <textarea
              id="editProductDescription"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={4}
              className="mt-1 block w-full border border-zinc-300 rounded-md shadow-sm p-2"
            ></textarea>
          </div>
          <div>
            <label htmlFor="editProductBrand" className="block text-sm font-medium text-zinc-700">Marca</label>
            <input
              type="text"
              id="editProductBrand"
              value={productBrand}
              onChange={(e) => { setProductBrand(e.target.value); setBrandError(null); }}
              className={`mt-1 block w-full border ${brandError ? 'border-red-500' : 'border-zinc-300'} rounded-md shadow-sm p-2`}
            />
            {brandError && <p className="text-red-500 text-xs mt-1">{brandError}</p>}
          </div>
          <div>
            <label htmlFor="editProductPrice" className="block text-sm font-medium text-zinc-700">Preço do produto (R$)</label>
            <input
              type="number"
              id="editProductPrice"
              value={productPrice}
              onChange={(e) => { setProductPrice(Number(e.target.value)); setPriceError(null); }}
              className={`mt-1 block w-full border ${priceError ? 'border-red-500' : 'border-zinc-300'} rounded-md shadow-sm p-2`}
            />
            {priceError && <p className="text-red-500 text-xs mt-1">{priceError}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="editShippingValue" className="block text-sm font-medium text-zinc-700">Valor do frete (R$)</label>
            <input
              type="number"
              id="editShippingValue"
              value={freeShipping ? '' : shippingValue}
              onChange={(e) => { setShippingValue(Number(e.target.value)); setShippingError(null); }}
              disabled={freeShipping}
              className={`mt-1 block w-full border ${shippingError && !freeShipping ? 'border-red-500' : 'border-zinc-300'} rounded-md shadow-sm p-2 disabled:bg-zinc-100`}
            />
            {shippingError && !freeShipping && <p className="text-red-500 text-xs mt-1">{shippingError}</p>}
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                id="editFreeShipping"
                checked={freeShipping}
                onChange={(e) => { setFreeShipping(e.target.checked); setShippingError(null); }}
                className="h-4 w-4 text-emerald-600 border-zinc-300 rounded"
              />
              <label htmlFor="editFreeShipping" className="ml-2 block text-sm text-zinc-900">Frete grátis</label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 text-zinc-800 font-semibold rounded-md hover:bg-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-md shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function Landing() {
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productPrice, setProductPrice] = useState<number | ''>('');
  const [shippingValue, setShippingValue] = useState<number | ''>('');
  const [freeShipping, setFreeShipping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [editingLandingPage, setEditingLandingPage] = useState<LandingPage | null>(null); // Estado para edição

  // Estados para validação inline do formulário de criação
  const [createTitleError, setCreateTitleError] = useState<string | null>(null);
  const [createImageError, setCreateImageError] = useState<string | null>(null);
  const [createPriceError, setCreatePriceError] = useState<string | null>(null);
  const [createBrandError, setCreateBrandError] = useState<string | null>(null);
  const [createShippingError, setCreateShippingError] = useState<string | null>(null);


  useEffect(() => {
    fetchLandingPages();
  }, []);

  const fetchLandingPages = async () => {
    try {
      setError(null);
      const data = await landingPageApi.listLandingPages();
      setLandingPages(data);
    } catch (err: any) {
      console.error("Erro ao carregar landing pages:", err);
      setError(err.message || "Não foi possível carregar as landing pages.");
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setProductImageFile(file);
      setCreateImageError(null); // Limpa erro ao selecionar imagem
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setProductImageFile(null);
      setProductImagePreview(null);
    }
  };

  const validateCreateForm = () => {
    let isValid = true;
    setCreateTitleError(null);
    setCreateImageError(null);
    setCreatePriceError(null);
    setCreateBrandError(null);
    setCreateShippingError(null);

    if (!productTitle.trim()) {
      setCreateTitleError("O título do produto é obrigatório.");
      isValid = false;
    }
    if (!productImageFile) {
      setCreateImageError("A foto do produto é obrigatória.");
      isValid = false;
    }
    if (productPrice === '' || isNaN(Number(productPrice)) || Number(productPrice) <= 0) {
      setCreatePriceError("O preço do produto é obrigatório e deve ser um número positivo.");
      isValid = false;
    }
    if (!productBrand.trim()) {
      setCreateBrandError("A marca do produto é obrigatória.");
      isValid = false;
    }
    if (!freeShipping && (shippingValue === '' || isNaN(Number(shippingValue)) || Number(shippingValue) < 0)) {
      setCreateShippingError("O valor do frete é obrigatório e deve ser um número não negativo quando o frete grátis não está marcado.");
      isValid = false;
    }

    return isValid;
  };

  const handleGenerateLandingPage = async () => {
    if (!validateCreateForm()) {
      setError("Por favor, preencha todos os campos obrigatórios corretamente.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const newLandingPageData = {
        image: productImageFile || undefined,
        productTitle,
        productDescription,
        productBrand,
        productPrice: Number(productPrice),
        shippingValue: freeShipping ? 0 : Number(shippingValue),
        freeShipping,
      };
      const createdLanding = await landingPageApi.createLandingPage(newLandingPageData);
      setSuccessMessage("Landing criada com sucesso!");
      
      // Limpar formulário
      setProductImageFile(null);
      setProductImagePreview(null);
      setProductTitle('');
      setProductDescription('');
      setProductBrand('');
      setProductPrice('');
      setShippingValue('');
      setFreeShipping(false);
      
      // Adicionar a nova landing page ao início da lista
      setLandingPages(prev => [createdLanding, ...prev]);

    } catch (err: any) {
      console.error("Erro ao gerar landing page:", err);
      setError(err.message || "Falha ao gerar landing page.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (slug: string) => {
    const fullUrl = `${window.location.origin}/l/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    alert('Link copiado para a área de transferência!');
  };

  const handleEdit = (lp: LandingPage) => {
    setEditingLandingPage(lp);
  };

  const handleSaveEditedLandingPage = (updatedLandingPage: LandingPage) => {
    setLandingPages(prev => prev.map(lp => lp.id === updatedLandingPage.id ? updatedLandingPage : lp));
    setSuccessMessage("Landing atualizada com sucesso!");
    setEditingLandingPage(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta landing? Esta ação não pode ser desfeita.")) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await landingPageApi.deleteLandingPage(id);
      setLandingPages(prev => prev.filter(lp => lp.id !== id));
      setSuccessMessage("Landing excluída com sucesso!");
    } catch (err: any) {
      console.error("Erro ao deletar landing page:", err);
      setError(err.message || "Falha ao excluir landing page. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (lp: LandingPage) => {
    const newStatus = lp.status === 'ATIVA' ? 'PAUSADA' : 'ATIVA';
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updatedLp = await landingPageApi.updateLandingPageStatus(lp.id, newStatus);
      setLandingPages(prev => prev.map(p => p.id === lp.id ? updatedLp : p));
      setSuccessMessage(`Landing page ${newStatus === 'ATIVA' ? 'ativada' : 'pausada'} com sucesso!`);
    } catch (err: any) {
      console.error("Erro ao mudar status da landing page:", err);
      setError(err.message || "Falha ao mudar status da landing page.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl md:text-2xl font-bold text-emerald-900 mb-6">Gerar Landing Page</h1>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold text-zinc-800 mb-4">Criar Nova Landing Page</h2>
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
        {successMessage && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{successMessage}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="productImage" className="block text-sm font-medium text-zinc-700">Foto do produto</label>
            <input
              type="file"
              id="productImage"
              accept="image/*"
              onChange={handleImageUpload}
              className="mt-1 block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
            {createImageError && <p className="text-red-500 text-xs mt-1">{createImageError}</p>}
            {productImagePreview && (
              <img
                src={productImagePreview}
                alt="Pré-visualização do produto"
                className="mt-2 max-h-40 object-cover rounded-md"
              />
            )}
          </div>
          <div>
            <label htmlFor="productTitle" className="block text-sm font-medium text-zinc-700">Título do produto</label>
            <input
              type="text"
              id="productTitle"
              value={productTitle}
              onChange={(e) => { setProductTitle(e.target.value); setCreateTitleError(null); }}
              className={`mt-1 block w-full border ${createTitleError ? 'border-red-500' : 'border-zinc-300'} rounded-md shadow-sm p-2`}
            />
            {createTitleError && <p className="text-red-500 text-xs mt-1">{createTitleError}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="productDescription" className="block text-sm font-medium text-zinc-700">Descrição do produto</label>
            <textarea
              id="productDescription"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={4}
              className="mt-1 block w-full border border-zinc-300 rounded-md shadow-sm p-2"
            ></textarea>
          </div>
          <div>
            <label htmlFor="productBrand" className="block text-sm font-medium text-zinc-700">Marca</label>
            <input
              type="text"
              id="productBrand"
              value={productBrand}
              onChange={(e) => { setProductBrand(e.target.value); setCreateBrandError(null); }}
              className={`mt-1 block w-full border ${createBrandError ? 'border-red-500' : 'border-zinc-300'} rounded-md shadow-sm p-2`}
            />
            {createBrandError && <p className="text-red-500 text-xs mt-1">{createBrandError}</p>}
          </div>
          <div>
            <label htmlFor="productPrice" className="block text-sm font-medium text-zinc-700">Preço do produto (R$)</label>
            <input
              type="number"
              id="productPrice"
              value={productPrice}
              onChange={(e) => { setProductPrice(Number(e.target.value)); setCreatePriceError(null); }}
              className={`mt-1 block w-full border ${createPriceError ? 'border-red-500' : 'border-zinc-300'} rounded-md shadow-sm p-2`}
            />
            {createPriceError && <p className="text-red-500 text-xs mt-1">{createPriceError}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="shippingValue" className="block text-sm font-medium text-zinc-700">Valor do frete (R$)</label>
            <input
              type="number"
              id="shippingValue"
              value={freeShipping ? '' : shippingValue} // Limpa o valor se frete grátis
              onChange={(e) => { setShippingValue(Number(e.target.value)); setCreateShippingError(null); }}
              disabled={freeShipping}
              className={`mt-1 block w-full border ${createShippingError && !freeShipping ? 'border-red-500' : 'border-zinc-300'} rounded-md shadow-sm p-2 disabled:bg-zinc-100`}
            />
            {createShippingError && !freeShipping && <p className="text-red-500 text-xs mt-1">{createShippingError}</p>}
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                id="freeShipping"
                checked={freeShipping}
                onChange={(e) => { setFreeShipping(e.target.checked); setCreateShippingError(null); }}
                className="h-4 w-4 text-emerald-600 border-zinc-300 rounded"
              />
              <label htmlFor="freeShipping" className="ml-2 block text-sm text-zinc-900">Frete grátis</label>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <button
            onClick={handleGenerateLandingPage}
            disabled={loading}
            className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-md shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Gerando...' : 'Gerar Landing Page'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5">
        <h2 className="text-lg font-semibold text-zinc-800 mb-4">
          Landing Pages Geradas: {landingPages.length}
        </h2>
        {landingPages.length === 0 ? (
          <p className="text-zinc-500">Nenhuma landing page gerada ainda.</p>
        ) : (
        <div className="grid grid-cols-1 gap-4">
          {landingPages.map((lp) => (
            <div key={lp.id} className="flex flex-col sm:flex-row items-start sm:items-center border border-zinc-200 rounded-lg shadow-sm p-3 gap-4">
              {lp.imageUrl && (
                <img src={lp.imageUrl} alt={lp.productTitle} className="w-20 h-20 object-cover rounded-md shrink-0" />
              )}
              <div className="flex-grow">
                <h3 className="font-bold text-zinc-800 text-lg">{lp.productTitle}</h3>
                <p className={`text-md font-semibold ${lp.freeShipping ? 'text-emerald-600' : 'text-zinc-800'}`}>
                    {BRL(lp.productPrice || 0)} {lp.freeShipping && <span className="text-emerald-600 text-xs font-bold ml-1">(FRETE GRÁTIS)</span>}
                  </p>
                  <a href={`/l/${lp.slug}`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 text-sm hover:underline block mt-1">
                    {`${window.location.origin}/l/${lp.slug}`}
                  </a>
                  <p className="text-zinc-500 text-xs mt-1">Criado em: {ddmmhh(lp.createdAt)}</p>
                  {lp.updatedAt && <p className="text-zinc-500 text-xs mt-1">Atualizado em: {ddmmhh(lp.updatedAt)}</p>}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto">
                  <button
                    onClick={() => handleEdit(lp)}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleStatus(lp)}
                    disabled={loading}
                    className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      lp.status === 'ATIVA'
                        ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 focus:ring-yellow-500'
                        : 'bg-green-50 text-green-700 hover:bg-green-100 focus:ring-green-500'
                    }`}
                  >
                    {lp.status === 'ATIVA' ? 'Pausar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(lp.id)}
                    disabled={loading}
                    className="px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => handleCopyLink(lp.slug)}
                    className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-md hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  >
                    Copiar link
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingLandingPage && (
        <EditLandingPageModal
          landingPage={editingLandingPage}
          onClose={() => setEditingLandingPage(null)}
          onSave={handleSaveEditedLandingPage}
        />
      )}
    </div>
  );
}
