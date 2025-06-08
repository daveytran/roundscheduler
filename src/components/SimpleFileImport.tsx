import React, { useState, useRef, ChangeEvent } from 'react';

interface SimpleFileImportProps {
  onImport: (data: string) => void;
  acceptedFileTypes?: string;
  placeholder?: string;
  buttonText?: string;
  fileDescription?: string;
}

const SimpleFileImport: React.FC<SimpleFileImportProps> = ({
  onImport,
  acceptedFileTypes = '.csv,.txt,text/plain,text/csv,application/vnd.ms-excel',
  placeholder = 'Paste your data here (tab separated format)...',
  buttonText = 'Import File',
  fileDescription = 'CSV or tab-separated file',
}) => {
  const [pastedData, setPastedData] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setPastedData(content);
        onImport(content);
      }
    };
    reader.readAsText(file);
    
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePasteImport = () => {
    if (pastedData.trim()) {
      onImport(pastedData);
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
      <div className="mb-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={acceptedFileTypes}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center justify-center cursor-pointer"
        >
          <span className="mr-2">📁</span> Select {fileDescription}
        </label>
      </div>

      <div className="text-center text-gray-500 font-medium mb-4">OR</div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          📋 Paste data (tab-separated format)
        </label>
        <textarea
          value={pastedData}
          onChange={(e) => setPastedData(e.target.value)}
          placeholder={placeholder}
          className="w-full h-32 p-3 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="mt-3">
          <button
            onClick={handlePasteImport}
            disabled={!pastedData.trim()}
            className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            🚀 {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimpleFileImport;