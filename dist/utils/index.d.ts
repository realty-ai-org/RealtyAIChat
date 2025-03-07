export declare const isNotDefined: <T>(value: T | null | undefined) => value is null | undefined;
export declare const isDefined: <T>(value: T | null | undefined) => value is NonNullable<T>;
export declare const isEmpty: (value: string | undefined | null) => value is undefined;
export declare const isNotEmpty: (value: string | undefined | null) => value is string;
export declare const sendRequest: <ResponseData>(params: {
    url: string;
    method: string;
    body?: Record<string, unknown> | FormData;
} | string) => Promise<{
    data?: ResponseData | undefined;
    error?: Error | undefined;
}>;
export declare const getCookie: (name: string) => string;
export declare const setCookie: (name: string, value: string, daysToLive: number) => void;
export declare const lightOrDark: (color: string) => "light" | "dark";
export declare const getContrastingColor: (color: string) => "#000" | "#fff";
//# sourceMappingURL=index.d.ts.map