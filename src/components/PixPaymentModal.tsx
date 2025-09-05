import React, { useEffect, useState } from 'react';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: string;
  pixCopyPaste: string;
  onCheckPaymentStatus: () => Promise<boolean>; // Função que verifica o status e retorna true se pago
  amount: number;
}

const PixPaymentModal: React.FC<PixPaymentModalProps> = ({
  isOpen,
  onClose,
  qrCode,
  pixCopyPaste,
  onCheckPaymentStatus,
  amount,
}) => {
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsChecking(true);
    const intervalId = setInterval(async () => {
      const isPaid = await onCheckPaymentStatus();
      if (isPaid) {
        clearInterval(intervalId);
        setIsChecking(false);
      }
    }, 5000); // Verifica a cada 5 segundos

    // Limpa o intervalo quando o modal é fechado
    return () => {
      clearInterval(intervalId);
      setIsChecking(false);
    };
  }, [isOpen, onCheckPaymentStatus]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCopyPaste);
    // Adicionar feedback visual (ex: toast) seria uma boa melhoria aqui
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
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

        <p className="text-lg font-semibold text-gray-800 mb-4">
          Total: {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>

        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg p-3 mb-6">
          <div className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Aguardando confirmação de pagamento...</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

export default PixPaymentModal;
