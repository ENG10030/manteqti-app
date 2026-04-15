declare module 'z-ai-web-dev-sdk' {
  interface ChatCompletionMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }

  interface ChatCompletionChoice {
    message: {
      content: string;
    };
  }

  interface ChatCompletion {
    choices: ChatCompletionChoice[];
  }

  interface ChatCompletions {
    create(params: {
      messages: ChatCompletionMessage[];
      thinking?: { type: string };
    }): Promise<ChatCompletion>;
  }

  interface ZAISDK {
    chat: {
      completions: ChatCompletions;
    };
  }

  const sdk: {
    create(): Promise<ZAISDK>;
  };

  export default sdk;
}
