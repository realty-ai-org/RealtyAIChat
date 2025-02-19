import { ButtonTheme, PopoutMessageConfig, PopoutMessageTheme } from "../types";
type Props = ButtonTheme & {
    userID: string;
    isBotOpened: boolean;
    popoutMessageConfig: PopoutMessageConfig | undefined;
    popoutMessageTheme: PopoutMessageTheme;
    avatarSrc?: string;
    toggleBot: () => void;
    liveIconPosition?: "left" | "right";
};
export declare const BubbleButton: (props: Props) => import("solid-js").JSX.Element;
export {};
//# sourceMappingURL=BubbleButton.d.ts.map