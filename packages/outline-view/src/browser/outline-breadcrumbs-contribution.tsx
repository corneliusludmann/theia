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
import { BreadcrumbsContribution } from '@theia/core/lib/browser/breadcrumbs/breadcrumbs-contribution';
import { Breadcrumb } from '@theia/core/lib/browser/breadcrumbs/breadcrumb';
import { injectable, inject, postConstruct } from 'inversify';
import { LabelProvider, BreadcrumbPopupContainerRenderer, BreadcrumbPopup, BreadcrumbsService } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { OutlineViewService } from './outline-view-service';
import { OutlineSymbolInformationNode } from './outline-view-widget';
import { EditorManager } from '@theia/editor/lib/browser';

export const OutlineBreadcrumbType = Symbol('OutlineBreadcrumb');

@injectable()
export class OutlineBreadcrumbsContribution implements BreadcrumbsContribution {

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(BreadcrumbPopupContainerRenderer)
    protected readonly breadcrumbPopupContainerRenderer: BreadcrumbPopupContainerRenderer;

    @inject(OutlineViewService)
    protected readonly outlineViewService: OutlineViewService;

    @inject(BreadcrumbsService)
    protected readonly breadcrumbsService: BreadcrumbsService;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    readonly type = OutlineBreadcrumbType;
    readonly priority: number = 200;

    private currentUri: URI | undefined = undefined;
    private currentBreadcrumbs: OutlineBreadcrumb[] = [];

    @postConstruct()
    init(): void {
        this.outlineViewService.onDidChangeOutline(roots => {
            if (roots.length > 0) {
                const first = roots[0];
                if ('uri' in first) {
                    this.updateOutlineItems(first['uri'] as URI, this.findSelectedNode(roots));
                }
            }
        });
        this.outlineViewService.onDidSelect(node => {
            if ('uri' in node) {
                this.updateOutlineItems(node['uri'] as URI, node);
            }
        });
    }

    protected async updateOutlineItems(uri: URI, selectedNode: OutlineSymbolInformationNode | undefined): Promise<void> {
        this.currentUri = uri;
        const outlinePath = this.toOutlinePath(selectedNode);
        if (outlinePath && selectedNode) {
            this.currentBreadcrumbs = outlinePath.map((node, index) =>
                new OutlineBreadcrumb(node, uri, index.toString(), node.name, 'symbol-icon symbol-icon-center ' + node.iconClass)
            );
        } else {
            this.currentBreadcrumbs = [];
        }
        this.breadcrumbsService.breadcrumbsChanges(uri);
    }

    async computeBreadcrumbs(uri: URI): Promise<Breadcrumb[]> {
        if (this.currentUri && uri.toString() === this.currentUri.toString()) {
            return this.currentBreadcrumbs;
        }
        return [];
    }

    async openPopup(breadcrumb: Breadcrumb, position: { x: number, y: number }, parent: HTMLElement): Promise<BreadcrumbPopup | undefined> {
        if (!OutlineBreadcrumb.is(breadcrumb)) {
            return undefined;
        }
        const items = this.siblings(breadcrumb.node).map(node => ({
            label: node.name,
            title: node.name,
            iconClass: 'symbol-icon symbol-icon-center ' + node.iconClass,
            action: () => this.revealInEditor(node)
        }));
        if (items.length > 0) {
            return this.breadcrumbPopupContainerRenderer.render(breadcrumb.id, position, this.renderItems(items), parent);
        }
        return this.breadcrumbPopupContainerRenderer.render(breadcrumb.id, position, <div style={{ margin: '.5rem' }}>No siblings.</div>, parent);
    }

    private revealInEditor(node: OutlineSymbolInformationNode): void {
        if ('range' in node && this.currentUri) {
            this.editorManager.open(this.currentUri, { selection: node['range'] });
        }
    }

    protected renderItems(items: { label: string, title: string, iconClass: string, action: () => void }[]): React.ReactNode {
        return <ul>
            {items.map((item, index) => <li key={index} title={item.title} onClick={_ => item.action()}>
                <span className={item.iconClass}></span> <span>{item.label}</span>
            </li>)}
        </ul>;
    }

    private siblings(node: OutlineSymbolInformationNode): OutlineSymbolInformationNode[] {
        if (!node.parent) { return []; }
        return node.parent.children.filter(n => n !== node).map(n => n as OutlineSymbolInformationNode);
    }

    /**
     * Returns the path of the given outline node.
     */
    private toOutlinePath(node: OutlineSymbolInformationNode | undefined, path: OutlineSymbolInformationNode[] = []): OutlineSymbolInformationNode[] | undefined {
        if (!node) { return undefined; }
        if (node.id === 'outline-view-root') { return path; }
        if (node.parent) {
            return this.toOutlinePath(node.parent as OutlineSymbolInformationNode, [node, ...path]);
        } else {
            return [node, ...path];
        }
    }

    /**
     * Find the node that is selected. Returns after the first match.
     */
    private findSelectedNode(roots: OutlineSymbolInformationNode[]): OutlineSymbolInformationNode | undefined {
        const result = roots.find(node => node.selected);
        if (result) {
            return result;
        }
        for (const node of roots) {
            const result2 = this.findSelectedNode(node.children.map(child => child as OutlineSymbolInformationNode));
            if (result2) {
                return result2;
            }
        }
    }
}

export class OutlineBreadcrumb implements Breadcrumb {
    constructor(
        readonly node: OutlineSymbolInformationNode,
        readonly uri: URI,
        readonly index: string,
        readonly label: string,
        readonly iconClass: string
    ) { }

    get id(): string {
        return this.type.toString() + '_' + this.uri.toString() + '_' + this.index;
    }

    get type(): symbol {
        return OutlineBreadcrumbType;
    }

    get longLabel(): string {
        return this.label;
    }
}
export namespace OutlineBreadcrumb {
    export function is(breadcrumb: Breadcrumb): breadcrumb is OutlineBreadcrumb {
        return 'node' in breadcrumb && 'uri' in breadcrumb;
    }
}
