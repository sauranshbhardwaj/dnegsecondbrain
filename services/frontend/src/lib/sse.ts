export type ParsedSseMessage<T> = {
  event: string;
  data: T;
};

export function parseSseMessages<T>(buffer: string): {
  messages: ParsedSseMessage<T>[];
  rest: string;
} {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const messages = blocks.flatMap((block) => {
    const event = block.match(/^event: (.+)$/m)?.[1];
    const data = block.match(/^data: (.+)$/m)?.[1];

    if (!event || !data) {
      return [];
    }

    try {
      return [{ event, data: JSON.parse(data) as T }];
    } catch {
      return [];
    }
  });

  return { messages, rest };
}
