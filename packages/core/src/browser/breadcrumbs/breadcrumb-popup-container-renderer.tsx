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

import * as React from 'react';
import { ReactRenderer } from '../widgets';
import { injectable } from 'inversify';
import { Breadcrumbs } from './breadcrumbs';
import PerfectScrollbar from 'perfect-scrollbar';
import { BreadcrumbPopup } from './breadcrumb-popup';

export const BreadcrumbPopupContainerRenderer = Symbol('BreadcrumbPopupContainerRenderer');
export interface BreadcrumbPopupContainerRenderer {
    /**
     * Renders the given breadcrumb and attaches it as child to the given parent element at the given anchor position.
     */
    render(breadcrumbId: string, anchor: { x: number, y: number }, content: React.ReactNode, parentElement: HTMLElement): BreadcrumbPopup;
}

@injectable()
export class DefaultBreadcrumbPopupContainerRenderer implements BreadcrumbPopupContainerRenderer {
    render(breadcrumbId: string, anchor: { x: number, y: number }, content: React.ReactNode, parentElement: HTMLElement): BreadcrumbPopup {
        const renderer = new ReactBreadcrumbPopupContainerRenderer(breadcrumbId, anchor, content, parentElement);
        renderer.render();
        return renderer;
    }
}

class ReactBreadcrumbPopupContainerRenderer extends ReactRenderer implements BreadcrumbPopup {

    isOpen: boolean = false;

    protected scrollbar: PerfectScrollbar | undefined;

    constructor(
        readonly breadcrumbId: string,
        readonly anchor: { x: number, y: number },
        readonly content: React.ReactNode,
        host: HTMLElement,
    ) { super(host); }

    protected doRender(): React.ReactNode {
        return <div className={Breadcrumbs.Styles.BREADCRUMB_POPUP}
            style={{ left: `${this.anchor.x}px`, top: `${this.anchor.y}px` }}
            onBlur={this.onBlur}
            tabIndex={0}
        >
            {this.content}
        </div >;
    }

    protected onBlur = (event: React.FocusEvent) => {
        if (event.relatedTarget && event.relatedTarget instanceof HTMLElement) {
            // event.relatedTarget is the element that has the focus after this popup looses the focus.
            // If a breadcrumb was clicked the following holds the breadcrumb ID of the clicked breadcrumb.
            const breadcrumbId = event.relatedTarget.getAttribute('data-breadcrumb-id');
            if (breadcrumbId && breadcrumbId === this.breadcrumbId) {
                // This is a click on the breadcrumb that has openend this popup.
                // We do not close this popup here but let the click event of the breadcrumb handle this instead
                // because it needs to know that this popup is open to decide if it just closes this popup or
                // also open a new popup.
                return;
            }
        }
        this.dispose();
    }

    render(): void {
        super.render();
        if (!this.scrollbar) {
            if (this.host.firstChild) {
                this.scrollbar = new PerfectScrollbar(this.host.firstChild as HTMLElement, {
                    handlers: ['drag-thumb', 'keyboard', 'wheel', 'touch'],
                    useBothWheelAxes: true,
                    scrollYMarginOffset: 8,
                    suppressScrollX: true
                });
            }
        } else {
            this.scrollbar.update();
        }
        this.focus();
        document.addEventListener('keyup', this.escFunction);
        this.isOpen = true;
    }

    focus(): boolean {
        if (this.host && this.host.firstChild) {
            (this.host.firstChild as HTMLElement).focus();
            return true;
        }
        return false;
    }

    dispose(): void {
        super.dispose();
        if (this.scrollbar) {
            this.scrollbar.destroy();
            this.scrollbar = undefined;
        }
        document.removeEventListener('keyup', this.escFunction);
        this.isOpen = false;
    }

    protected escFunction = (event: KeyboardEvent) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
            this.dispose();
        }
    }
}
