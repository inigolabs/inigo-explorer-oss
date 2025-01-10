export interface ISchemaPropsItemPropertyTypeDef {
  Index: number;
  TypeName: string;
  Required: boolean;
  List?: ISchemaPropsItemPropertyTypeDef;
}

export interface ISchemaPropsItemProperty {
  index: number;
  name: string;
  count: number;
  calls?: number;
  tags?: { key: string; details?: any }[];
  type?: string;
  description?: string;
  typeDetails: {
    Name: string;
    DefaultValue: any;
    Index: number;
    Type: ISchemaPropsItemPropertyTypeDef;
  };
  args?: Record<
    string,
    {
      Name: string;
      DefaultValue: any;
      Index: number;
      Type: ISchemaPropsItemPropertyTypeDef;
    }
  >;
}

export interface ISchemaPropsItem {
  name: string;
  type: ISchemaPropsItemType;
  directive?: {
    locations: string[];
    args?: Record<
      string,
      {
        Name: string;
        DefaultValue: any;
        Index: number;
        Type: ISchemaPropsItemPropertyTypeDef;
      }
    >;
  };
  tags: ISchemaPropsItemProperty["tags"];
  description?: string;
  properties: ISchemaPropsItemProperty[];
  implements?: string[];
}

export type ISchemaPropsModel = ISchemaPropsItem[];

export interface ISchemaProps {
  loading?: boolean;
  selectedType?: string;
  onSelect?: (selectedType: ISchemaPropsItem) => void;
  data: ISchemaPropsModel;
  theme: "light" | "dark";
  activeService?: { name: string; label?: string };
  activeParentService?: { name: string; label?: string };
  filter?: Record<string, any>;
  basePath?: string;
  compact?: boolean;
  navigationMode?: "router" | "query";
}

export enum ISchemaPropsItemType {
  All = "all",
  Types = "types",
  Inputs = "inputs",
  Interfaces = "interfaces",
  Enums = "enums",
  Unions = "unions",
  Schema = "schema",
  Scalars = "scalars",
  Directives = "directives",
}
