/** Capture tree coordinates, not the user's current scroll/pan/zoom viewport. */
export function treeExportFrame(bounds: { x: number; y: number; width: number; height: number }) {
    const padding = 32;
    const width = Math.max(1, Math.ceil(bounds.width + padding * 2));
    const height = Math.max(1, Math.ceil(bounds.height + padding * 2));
    return {
        width,
        height,
        x: bounds.x - padding,
        y: bounds.y - padding,
        // Bound raster memory and browser canvas dimensions for large trees.
        scale: Math.min(2, 16384 / width, 16384 / height, Math.sqrt(16000000 / (width * height))),
    };
}

export function prepareTreeExport(container: HTMLElement) {
    const content = container.querySelector<SVGGElement>('[data-panning-surface]');
    if (!content) throw new Error('Tree content is not available for export');
    // getBBox returns local geometry, excluding ancestor pan/zoom transforms.
    const frame = treeExportFrame(content.getBBox());
    return {
        width: frame.width,
        height: frame.height,
        scale: frame.scale,
        onclone: (_document: Document, clonedContainer: HTMLElement) => {
            const group = clonedContainer.querySelector<SVGGElement>('[data-panning-surface]');
            const svg = group?.ownerSVGElement;
            if (!group || !svg) throw new Error('Cloned tree content is missing');
            group.removeAttribute('transform');
            group.style.transform = 'none';
            group.parentElement?.removeAttribute('transform');
            if (group.parentElement) group.parentElement.style.transform = 'none';
            svg.setAttribute('viewBox', `${frame.x} ${frame.y} ${frame.width} ${frame.height}`);
            svg.setAttribute('width', String(frame.width));
            svg.setAttribute('height', String(frame.height));
            // Expand every clipping wrapper in the clone only. The live tree is untouched.
            let element: Element | null = svg;
            while (element) {
                const style = (element as HTMLElement | SVGElement).style;
                style.width = `${frame.width}px`;
                style.height = `${frame.height}px`;
                style.minWidth = '0';
                style.minHeight = '0';
                style.maxWidth = 'none';
                style.maxHeight = 'none';
                style.overflow = 'visible';
                style.padding = '0';
                style.border = '0';
                style.flex = 'none';
                element.scrollLeft = 0;
                element.scrollTop = 0;
                if (element === clonedContainer) break;
                element = element.parentElement;
            }
        },
    };
}
