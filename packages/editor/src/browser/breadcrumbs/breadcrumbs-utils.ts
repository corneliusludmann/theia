/********************************************************************************
 * Copyright (C) 2019 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Breadcrumbs } from './breadcrumbs';
import { OutlineSymbolInformationNode } from '@theia/outline-view/lib/browser';

/**
 * Traverse upstream (starting with the HTML element `child`) to find a parent HTML element
 * that has the CSS class `Breadcrumbs.Styles.BREADCRUMB_ITEM`.
 */
export function findParentItemHtmlElement(child: HTMLElement): HTMLElement | undefined {
    return findParentHtmlElement(child, Breadcrumbs.Styles.BREADCRUMB_ITEM);
}

/**
 * Traverse upstream (starting with the HTML element `child`) to find a parent HTML element
 * that has the CSS class `Breadcrumbs.Styles.BREADCRUMBS`.
 */
export function findParentBreadcrumbsHtmlElement(child: HTMLElement): HTMLElement | undefined {
    return findParentHtmlElement(child, Breadcrumbs.Styles.BREADCRUMBS);
}

/**
 * Traverse upstream (starting with the HTML element `child`) to find a parent HTML element
 * that has the given CSS class.
 */
export function findParentHtmlElement(child: HTMLElement, cssClass: string): HTMLElement | undefined {
    if (child.classList.contains(cssClass)) {
        return child;
    } else {
        if (child.parentElement !== null) {
            return findParentHtmlElement(child.parentElement, cssClass);
        }
    }
}

/**
 * Determines the popup anchor for the given mouse event.
 *
 * It finds the parent HTML element with CSS class `Breadcrumbs.Styles.BREADCRUMB_ITEM` of event's target element
 * and return the bottom left corner of this element.
 */
export function determinePopupAnchor(event: MouseEvent): { x: number, y: number } | undefined {
    if (event.target === null || !(event.target instanceof HTMLElement)) {
        return undefined;
    }
    const itemHtmlElement = findParentItemHtmlElement(event.target);
    if (itemHtmlElement) {
        return {
            x: itemHtmlElement.getBoundingClientRect().left,
            y: itemHtmlElement.getBoundingClientRect().bottom
        };
    }
}

/**
 * Find the node that is selected. Returns after the first match.
 */
export function findSelectedNode(roots: OutlineSymbolInformationNode[]): OutlineSymbolInformationNode | undefined {
    const result = roots.find(node => node.selected);
    if (result) {
        return result;
    }
    for (const node of roots) {
        const result2 = findSelectedNode(node.children.map(child => child as OutlineSymbolInformationNode));
        if (result2) {
            return result2;
        }
    }
}

/**
 * Returns the path of the given outline node.
 */
export function toOutlinePath(node: OutlineSymbolInformationNode | undefined, path: OutlineSymbolInformationNode[] = []): OutlineSymbolInformationNode[] | undefined {
    if (!node) { return undefined; }
    if (node.id === 'outline-view-root') { return path; }
    if (node.parent) {
        return toOutlinePath(node.parent as OutlineSymbolInformationNode, [node, ...path]);
    } else {
        return [node, ...path];
    }
}
