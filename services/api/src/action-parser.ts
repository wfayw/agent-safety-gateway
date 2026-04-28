import type {
  ActionTuple,
  JsonObject,
  ParseError,
  ToolCallRequest,
} from "@agent-safety-gateway/shared";

export type ActionParseSuccess = {
  success: true;
  actionTuple: ActionTuple;
};

export type ActionParseFailure = {
  success: false;
  errors: ParseError[];
};

export type ActionParseResult = ActionParseSuccess | ActionParseFailure;

export type ParserSelectionSuccess = {
  success: true;
  parser: ActionParser;
};

export type ParserSelectionFailure = {
  success: false;
  errors: ParseError[];
};

export type ParserSelectionResult =
  | ParserSelectionSuccess
  | ParserSelectionFailure;

export type ActionParser = {
  supports: (request: ToolCallRequest) => boolean;
  parse: (request: ToolCallRequest) => ActionParseResult;
};

export type ActionParserRegistry = {
  getParser: (request: ToolCallRequest) => ParserSelectionResult;
  parse: (request: ToolCallRequest) => ActionParseResult;
};

const toParseError = (
  code: string,
  message: string,
  field: string,
  details: JsonObject,
): ParseError => ({
  code,
  message,
  field,
  details,
});

export const createActionParserRegistry = (
  parsers: readonly ActionParser[],
): ActionParserRegistry => ({
  getParser(request) {
    const parser = parsers.find((candidateParser) =>
      candidateParser.supports(request),
    );

    if (!parser) {
      return {
        success: false,
        errors: [
          toParseError(
            "parser_not_found",
            `No action parser is registered for tool type '${request.toolType}'.`,
            "toolType",
            {
              requestId: request.id,
              toolType: request.toolType,
              registeredParserCount: parsers.length,
            },
          ),
        ],
      };
    }

    return {
      success: true,
      parser,
    };
  },
  parse(request) {
    const selection = this.getParser(request);

    if (!selection.success) {
      return selection;
    }

    return selection.parser.parse(request);
  },
});
