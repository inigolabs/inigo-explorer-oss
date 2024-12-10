import { editor } from 'monaco-editor';

const theme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'F8F9FA', background: 'fffffe' },
    { token: 'invalid', foreground: 'cd3131' },
    { token: 'emphasis', fontStyle: 'italic' },
    { token: 'strong', fontStyle: 'bold' },

    { token: 'variable', foreground: '001188' },
    { token: 'variable.predefined', foreground: '4864AA' },
    { token: 'constant', foreground: 'dd0000' },
    { token: 'comment', foreground: '008000' },
    { token: 'number', foreground: '09885A' },
    { token: 'number.hex', foreground: '3030c0' },
    { token: 'regexp', foreground: '800000' },
    { token: 'annotation', foreground: '808080' },
    { token: 'type', foreground: 'B39DDB' },

    { token: 'delimiter', foreground: '6E757C' },
    { token: 'delimiter.html', foreground: '383838' },
    { token: 'delimiter.xml', foreground: 'C5CAE9' },

    { token: 'tag', foreground: '800000' },
    { token: 'tag.id.jade', foreground: '4F76AC' },
    { token: 'tag.class.jade', foreground: '4F76AC' },
    { token: 'meta.scss', foreground: '800000' },
    { token: 'metatag', foreground: 'e00000' },
    { token: 'metatag.content.html', foreground: 'FF0000' },
    { token: 'metatag.html', foreground: '808080' },
    { token: 'metatag.xml', foreground: '808080' },
    { token: 'metatag.php', fontStyle: 'bold' },

    { token: 'key', foreground: '80CBC4' },
    { token: 'string.key.json', foreground: 'A31515' },
    { token: 'string.value.json', foreground: '0451A5' },

    { token: 'attribute.name', foreground: 'FF0000' },
    { token: 'attribute.value', foreground: '0451A5' },
    { token: 'attribute.value.number', foreground: '09885A' },
    { token: 'attribute.value.unit', foreground: '09885A' },
    { token: 'attribute.value.html', foreground: 'C5CAE9' },
    { token: 'attribute.value.xml', foreground: 'C5CAE9' },

    { token: 'string', foreground: '80CBC4' },
    { token: 'string.html', foreground: 'C5CAE9' },
    { token: 'string.sql', foreground: 'FF0000' },
    { token: 'string.yaml', foreground: '0451A5' },

    { token: 'keyword', foreground: 'C5CAE9' },
    { token: 'keyword.json', foreground: '0451A5' },
    { token: 'keyword.flow', foreground: 'AF00DB' },
    { token: 'keyword.flow.scss', foreground: 'C5CAE9' },

    { token: 'operator.scss', foreground: '666666' },
    { token: 'operator.sql', foreground: '778899' },
    { token: 'operator.swift', foreground: '666666' },
    { token: 'predefined.sql', foreground: 'FF00FF' },
  ],
  colors: {
    'editor.foreground': '#f6f8fa',
    'editor.background': '#212529',
    'editor.selectionBackground': '#2A2F34',
    'editor.inactiveSelectionBackground': '#2A2F34',
    'editor.lineHighlightBackground': '#2A2F34',
    'editorCursor.foreground': '#ffffff',
    'editorWhitespace.foreground': '#6a737d',
    'editorIndentGuide.background': '#6E757C',
    'editorIndentGuide.activeBackground': '#CFD4D9',
    'editor.selectionHighlightBorder': '#2A2F34',
  },
};

export default theme;
