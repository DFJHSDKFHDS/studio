
// Type definitions for jsQR 1.3
// Project: https://github.com/cozmo/jsQR#readme
// Definitions by: Sjoerd Diepen <https://github.com/sjoerdiepen>
//                 Zheyang Song <https://github.com/ZheyangSong>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

export default jsQR;

declare function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: Options,
): QRCode | null;

export interface Options {
    /**
     * @default "dontInvert"
     */
    inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst';
}

export interface QRCode {
    binaryData: number[];
    data: string;
    chunks: Chunk[];
    version: number;
    location: QRCodeLocation;
}

export interface Chunk {
    type: 'numeric' | 'alphanumeric' | 'byte' | 'kanji';
    bytes: number[];
    data: string;
    /**
     * For type "numeric" and "alphanumeric" this will be a string. For type
     * "byte" and "kanji" this will be an array of numbers.
     */
}

export interface Point {
    x: number;
    y: number;
}

export interface QRCodeLocation {
    topRightCorner: Point;
    topLeftCorner: Point;
    bottomRightCorner: Point;
    bottomLeftCorner: Point;

    topRightFinderPattern: Point;
    topLeftFinderPattern: Point;
    bottomLeftFinderPattern: Point;

    bottomRightAlignmentPattern?: Point;
}
