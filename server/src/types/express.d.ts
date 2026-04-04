// Extended type declarations for Express and related modules
declare global {
  namespace Express {
    interface Request {
      headers: any;
      params: any;
      body: any;
      user?: {
        id: string;
        email: string;
        role: string;
      };
      raw: any;
    }
    interface Response {
      status(code: number): Response;
      json(data: any): Response;
    }
    interface Router {
      post(path: string, ...handlers: any[]): void;
      get(path: string, ...handlers: any[]): void;
      put(path: string, ...handlers: any[]): void;
      delete(path: string, ...handlers: any[]): void;
      patch(path: string, ...handlers: any[]): void;
      use(path: string, handler: any): void;
    }
    function Router(): Router;
    function raw(options: any): any;
  }
}

declare module 'express-validator' {
  export function body(field: string): any;
  export function param(field: string): any;
  export function validationResult(req: any): any;
}

declare module 'jsonwebtoken' {
  export function verify(token: string, secret: string): any;
  export function sign(payload: any, secret: string): string;
  export interface JwtPayload {
    userId: string;
    iat: number;
    exp: number;
  }
}

declare module 'bcrypt' {
  export function compare(password: string, hash: string): Promise<boolean>;
  export function hash(password: string, salt: number): Promise<string>;
}

declare module 'stripe' {
  interface Stripe {
    webhooks: {
      constructEvent(body: Buffer, signature: string, secret: string): any;
    };
    checkout: {
      sessions: {
        create(params: any): Promise<any>;
      };
    };
    subscriptions: {
      update(id: string, params: any): Promise<any>;
      del(id: string): Promise<any>;
    };
  }
  const stripe: Stripe;
  export default stripe;
}

declare module 'helmet' {
  export function helmet(): any;
}

declare module 'cors' {
  export function cors(options: any): any;
}

declare module 'cookie-parser' {
  export function cookieParser(): any;
}

declare module 'pg' {
  export class Pool {
    constructor(options: any);
    query<T>(text: string, params?: any[]): Promise<QueryResult<T>>;
    on(event: string, handler: Function): void;
    connect(): Promise<any>;
  }
  export interface QueryResult<T> {
    rows: T[];
  }
  export interface QueryResultRow {}
}

declare module 'multer' {
  export function multer(options: any): any;
}

declare module 'validator' {
  export function isEmail(email: string): boolean;
  export function normalizeEmail(email: string): string;
}

declare module 'express' {
  export function json(): any;
  export function urlencoded(options: any): any;
  export function raw(options: any): any;
  export const Router: any;
  export interface Request {
    headers: any;
    params: any;
    body: any;
    query: any;
    user?: {
      id: string;
      email: string;
      role: string;
    };
    raw: any;
  }
  export interface Response {
    status(code: number): Response;
    json(data: any): Response;
    send(data?: any): Response;
    end(): Response;
  }
}
