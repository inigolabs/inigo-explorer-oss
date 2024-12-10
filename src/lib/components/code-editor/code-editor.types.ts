import { FormControl, FormControlRef } from '../Form/Form';
import { IntrospectionQuery } from 'graphql';
import * as monaco from 'monaco-editor';
import { Maybe } from '../../utils/types';

export interface ICodeEditorRef extends FormControlRef<string> {
  focus: (cursorPosition?: { lineNumber: number; column: number }) => void;
  getPosition: () => { lineNumber: number; column: number };
  setMarkers: (markers: monaco.editor.IMarkerData[]) => void;
}

export interface ICodeEditorProps extends FormControl<string> {
  className?: string;
  label?: React.ReactNode;
  defaultLanguage?: string;
  readOnly?: boolean;
  wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  graphQLSchema?: IntrospectionQuery;
  graphQLSchemaUri?: string;
  graphQLSchemaHeaders?: Record<string, any>;
  extraLib?: string;
  jsonSchema?: Record<string, any>;
  onCursorPositionChange?: (position: { lineNumber: number; column: number }) => void;
  padding?: number;
  schema?: Maybe<{
    str: string;
    doc?: any;
    version: number;
  }>;
  theme?: 'light' | 'dark';
}
