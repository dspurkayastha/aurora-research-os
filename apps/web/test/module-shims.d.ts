declare module "archiver" {
  type AppendData = Buffer | Uint8Array | string;
  interface ArchiverInstance {
    append(data: AppendData, options: { name: string }): void;
    pipe(stream: any): void;
    finalize(): Promise<void>;
    on(event: "error", handler: (error: Error) => void): void;
  }
  function archiver(format: string, options?: Record<string, unknown>): ArchiverInstance;
  namespace archiver {
    type Archiver = ArchiverInstance;
  }
  export = archiver;
}

declare module "docx" {
  export enum HeadingLevel {
    TITLE,
    HEADING_1,
  }
  export enum AlignmentType {
    CENTER,
  }
  export class TextRun {
    constructor(options: Record<string, unknown>);
  }
  export class Paragraph {
    constructor(options: Record<string, unknown>);
  }
  export class Document {
    constructor(options: Record<string, unknown>);
  }
  export class Packer {
    static toBuffer(doc: Document): Promise<Uint8Array>;
  }
}

declare module "next/server" {
  export class NextResponse extends Response {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    static json(body: any, init?: ResponseInit): NextResponse;
  }
}

declare module "@aurora/core" {
  export type SampleSizeAssumptionsBase = Record<string, any>;
  export type BaselineBuildResult = Record<string, any>;
  export type RegistryFieldMapping = Record<string, any>;
  export type ValidationIssue = Record<string, any>;
  export function buildBaselinePackageFromIdea(
    idea: string,
    assumptions?: Partial<SampleSizeAssumptionsBase>
  ): BaselineBuildResult;
}

declare module "node:stream" {
  export class Writable {
    constructor(options: { write(chunk: any, encoding: any, callback: (error?: Error | null) => void): void });
    on(event: string, handler: (...args: any[]) => void): void;
  }
}
