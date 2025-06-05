declare module 'react-csv-importer' {
  import { ReactNode } from 'react';

  export interface ImporterProps {
    dataHandler: (rows: any[]) => void;
    defaultNoHeader?: boolean;
    restartable?: boolean;
    onStart?: (info: { file: File; fields: string[] }) => void;
    onComplete?: (info: { file: File; rows: any[] }) => void;
    onError?: (error: Error) => void;
    children: ReactNode;
  }

  export interface ImporterFieldProps {
    name: string;
    label: string;
    optional?: boolean;
  }

  export declare const Importer: React.FC<ImporterProps>;
  export declare const ImporterField: React.FC<ImporterFieldProps>;
} 