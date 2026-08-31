export interface BeatSeatStatusViewElements {
  readonly tableHost: {
    readonly clientWidth: number;
    readonly clientHeight: number;
  };
  readonly beatSeatStatus: {
    innerHTML: string;
    readonly style: {
      width: string;
      height: string;
      left: string;
      top: string;
    };
    querySelectorAll<Element extends HTMLButtonElement>(
      selector: string,
    ): {
      forEach(callback: (element: Element) => void): void;
    };
  };
}
