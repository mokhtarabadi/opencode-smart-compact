import { type JsonSchema, type LanguageModel, type LLMRequest } from "../../schema/index.js";
export declare const ToolSchemaProjection: {
    readonly gemini: (schema: JsonSchema) => JsonSchema;
    readonly moonshot: (schema: JsonSchema) => JsonSchema;
    readonly openAI: (schema: JsonSchema) => JsonSchema;
    readonly responses: (schema: JsonSchema) => JsonSchema;
    readonly tools: (entries: LLMRequest["tools"], model: LanguageModel) => LLMRequest["tools"];
};
