import { useRef } from "react";

const MODAL_LAYER_BASE = 1400;
const MODAL_LAYER_STEP = 10;

let modalLayerSeed = 0;

export type ModalLayer = {
	backdrop: number;
	surface: number;
};

export function useModalLayer(): ModalLayer {
	const layerRef = useRef<ModalLayer | null>(null);
	if (!layerRef.current) {
		const layer = MODAL_LAYER_BASE + ++modalLayerSeed * MODAL_LAYER_STEP;
		layerRef.current = {
			backdrop: layer,
			surface: layer + 1,
		};
	}
	return layerRef.current;
}
