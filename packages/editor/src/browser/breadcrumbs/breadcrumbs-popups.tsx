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
import { ReactRenderer } from '@theia/core/lib/browser';
import { Breadcrumbs } from './breadcrumbs';
import PerfectScrollbar from 'perfect-scrollbar';

export class BreadcrumbsListPopup extends ReactRenderer {

    protected scrollbar: PerfectScrollbar | undefined;

    constructor(
        protected readonly items: { label: string, title: string, iconClass: string, action: () => void }[],
        protected readonly anchor: { x: number, y: number },
        host: HTMLElement
    ) {
        super(host);
    }

    protected doRender(): React.ReactNode {
        return <div className={Breadcrumbs.Styles.BREADCRUMB_POPUP}
            style={{ left: `${this.anchor.x}px`, top: `${this.anchor.y}px` }}
            onBlur={_ => this.dispose()}
            tabIndex={0}
        >
            <ul>
                {this.items.map((item, index) => <li key={index} title={item.title} onClick={_ => item.action()}>
                    <span className={item.iconClass}></span> <span>{item.label}</span>
                </li>)}
            </ul>
        </div >;
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
    }

    protected escFunction = (event: KeyboardEvent) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
            this.dispose();
        }
    }
}
