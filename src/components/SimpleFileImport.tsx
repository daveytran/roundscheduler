import React, { useState, useRef, useId, ChangeEvent, DragEvent } from 'react';

interface SimpleFileImportProps {
  onImport: (data: string) => void;
  acceptedFileTypes?: string;
  placeholder?: string;
  buttonText?: string;
  fileDescription?: string;
  aiMode?: 'players' | 'schedule';
  aiDescription?: string;
}

const SimpleFileImport: React.FC<SimpleFileImportProps> = ({
  onImport,
  acceptedFileTypes = '.csv,.txt,text/plain,text/csv,application/vnd.ms-excel',
  placeholder = 'Paste your data here (tab separated format)...',
  buttonText = 'Import File',
  fileDescription = 'CSV or tab-separated file',
  aiMode,
  aiDescription,
}) => {
  const [pastedData, setPastedData] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isAiImporting, setIsAiImporting] = useState(false);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState<{ rowCount: number; confidence: number; dataType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadTextIntoEditor = (content: string, sourceLabel: string) => {
    setPastedData(content);
    setStatusMessage(`${sourceLabel} loaded. Choose raw import or AI normalization.`);
    setError('');
    setAiWarnings([]);
  };

  const readFileContent = async (file: File): Promise<void> => {
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string;
      if (content) {
        loadTextIntoEditor(content, file.name);
      } else {
        setError('The file was empty.');
      }
    };
    reader.onerror = () => {
      setError('Unable to read that file.');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      readFileContent(file).catch(() => setError('Unable to process the selected file.'));
    }
    resetFileInput();
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      readFileContent(droppedFile).catch(() => setError('Unable to process the dropped file.'));
    }
  };

  const handleRawImport = () => {
    if (!pastedData.trim()) {
      setError('Paste data or load a file before importing.');
      return;
    }

    setError('');
    setAiWarnings([]);
    setAiSummary(null);
    onImport(pastedData);
  };

  const handleAiImport = async () => {
    if (!aiMode) return;
    if (!pastedData.trim()) {
      setError('Paste data or load a file before using AI import.');
      return;
    }

    setIsAiImporting(true);
    setError('');
    setStatusMessage('AI is normalizing your data...');

    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: aiMode,
          input: pastedData,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'AI import failed.');
      }

      if (!result.normalizedText || typeof result.normalizedText !== 'string') {
        throw new Error('AI returned an invalid import payload.');
      }

      setPastedData(result.normalizedText);
      setAiWarnings(Array.isArray(result.warnings) ? result.warnings : []);
      setAiSummary({
        rowCount: typeof result.rowCount === 'number' ? result.rowCount : 0,
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        dataType: typeof result.dataType === 'string' ? result.dataType : aiMode,
      });
      setStatusMessage('AI normalization complete. Data imported.');
      onImport(result.normalizedText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI import failed.');
      setStatusMessage('');
    } finally {
      setIsAiImporting(false);
    }
  };

  const handleClear = () => {
    setPastedData('');
    setStatusMessage('');
    setError('');
    setAiWarnings([]);
    setAiSummary(null);
    resetFileInput();
  };

  return (
    <div
      className={`rounded-xl border-2 p-4 transition-colors ${
        isDragging ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 bg-slate-50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">Load your source data</p>
          <p className="text-xs text-slate-500">
            Drag and drop a file, choose a file, or paste data directly from spreadsheets.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={acceptedFileTypes}
            className="hidden"
            id={fileInputId}
          />
          <label
            htmlFor={fileInputId}
            className="inline-flex cursor-pointer items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Select {fileDescription}
          </label>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">Data input</label>
        <textarea
          value={pastedData}
          onChange={e => {
            setPastedData(e.target.value);
            setStatusMessage('');
            setError('');
          }}
          placeholder={placeholder}
          className="h-48 w-full resize-none rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <button
          type="button"
          onClick={handleRawImport}
          disabled={!pastedData.trim()}
          className="inline-flex flex-1 items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {buttonText}
        </button>

        {aiMode && (
          <button
            type="button"
            onClick={handleAiImport}
            disabled={!pastedData.trim() || isAiImporting}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isAiImporting
              ? 'Normalizing...'
              : aiMode === 'players'
                ? 'AI Normalize + Import Players'
                : 'AI Normalize + Import Match List'}
          </button>
        )}
      </div>

      {aiDescription && aiMode && <p className="mt-3 text-xs text-cyan-700">{aiDescription}</p>}

      {statusMessage && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {statusMessage}
        </div>
      )}

      {aiSummary && (
        <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
          AI imported {aiSummary.rowCount} {aiSummary.dataType === 'players' ? 'player' : 'match'} row
          {aiSummary.rowCount === 1 ? '' : 's'} with {Math.round(aiSummary.confidence * 100)}% confidence.
        </div>
      )}

      {aiWarnings.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-sm font-semibold text-amber-800">AI warnings</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
            {aiWarnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}
    </div>
  );
};

export default SimpleFileImport;
