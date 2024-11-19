import { ButtonTheme } from "../types";
type Props = ButtonTheme & {
    isBotOpened: boolean;
    popoutMessage: {
        message: string;
        delay?: number;
        backgroundColor?: string;
        textColor?: string;
    };
    avatarSrc?: string;
    toggleBot: () => void;
};
export declare const BubbleButton: (props: Props) => import("solid-js").JSX.Element;
export {};
//# sourceMappingURL=BubbleButton.d.ts.map