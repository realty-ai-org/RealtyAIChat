import { JSX } from "solid-js/jsx-runtime";
type TextAreaInputProps = {
    ref: HTMLTextAreaElement | undefined;
    onInput: (value: string) => void;
    fontSize?: number;
} & Omit<JSX.InputHTMLAttributes<HTMLTextAreaElement>, "onInput">;
export declare const TextAreaInput: (props: TextAreaInputProps) => JSX.Element;
export {};
//# sourceMappingURL=TextAreaInput.d.ts.map