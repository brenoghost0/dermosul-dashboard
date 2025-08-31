import React from 'react';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: string;
  pixCopyPaste: string;
  onConfirm: () => void;
  amount: number;
}

const PixPaymentModal: React.FC<PixPaymentModalProps> = ({
  isOpen,
  onClose,
  qrCode,
  pixCopyPaste,
  onConfirm,
  amount,
}) => {
  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCopyPaste);
    // Adicionar feedback visual para o usuário, se desejar
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Pague com Pix</h2>
        <p className="text-gray-600 mb-6">
          Escaneie o QR Code abaixo com o app do seu banco ou copie o código.
        </p>
        
        <img src={qrCode} alt="PIX QR Code" className="mx-auto w-48 h-48 mb-4 border rounded" />
        
        <div className="bg-gray-100 p-3 rounded-md mb-6">
          <p className="text-sm text-gray-500 mb-2">PIX Copia e Cola:</p>
          <div className="flex items-center">
            <input 
              type="text" 
              readOnly 
              value={pixCopyPaste} 
              className="w-full bg-transparent text-xs text-gray-700"
            />
            <button onClick={handleCopy} className="ml-2 text-sm text-emerald-600 hover:text-emerald-800 font-semibold">
              Copiar
            </button>
          </div>
        </div>

        <p className="text-lg font-semibold text-gray-800 mb-6">
          Total: {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>

        <div className="space-y-4">
          <button
            onClick={onConfirm}
            className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Simular Pagamento (Aprovação Automática)
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PixPaymentModal;
