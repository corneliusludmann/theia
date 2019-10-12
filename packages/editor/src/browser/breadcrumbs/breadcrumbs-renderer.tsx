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

import '../../../src/browser/breadcrumbs/breadcrumbs.css';

import * as React from 'react';
import { ReactRenderer, LabelProvider, OpenerService } from '@theia/core/lib/browser';
import { TextEditor } from '../editor';
import { FileSystem } from '@theia/filesystem/lib/common/filesystem';
import URI from '@theia/core/lib/common/uri';
import { MessageService, DisposableCollection } from '@theia/core';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { Breadcrumbs } from './breadcrumbs';
import { BreadcrumbItem, FileBreadcrumbItem, OutlineBreadcrumbItem } from './breadcrumbs-items';
import { OutlineViewService } from '@theia/outline-view/lib/browser/outline-view-service';
import { OutlineSymbolInformationNode } from '@theia/outline-view/lib/browser';
import { toOutlinePath, findSelectedNode } from './breadcrumbs-utils';
import PerfectScrollbar from 'perfect-scrollbar';
import { inject, injectable, postConstruct } from 'inversify';

@injectable()
export class BreadcrumbsRenderer extends ReactRenderer {

    @inject('TextEditor')
    protected readonly editor: TextEditor;

    @inject(FileSystem)
    protected readonly fileSystem: FileSystem;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(OutlineViewService)
    protected readonly outlineViewService: OutlineViewService;

    private readonly filePathItems = new Array<BreadcrumbItem>();
    private outlineItems = new Array<BreadcrumbItem>();

    private disposables = new DisposableCollection();
    protected scrollbar: PerfectScrollbar | undefined;

    @postConstruct()
    init(): void {
        this.createFilePathItems();
    }

    protected async createFilePathItems(): Promise<void> {
        const resourceUri = this.editor.getResourceUri();
        const workspaceRootUri = this.workspaceService.getWorkspaceRootUri(resourceUri);
        if (resourceUri) {
            for (const uri of resourceUri.allLocations.reverse().filter(u => !u.path.isRoot && (!workspaceRootUri || !u.isEqualOrParent(workspaceRootUri)))) {
                const icon = await this.labelProvider.getIcon(uri);
                const label = this.labelProvider.getName(uri);
                const title = this.labelProvider.getLongName(uri);
                const itemCssClass = Breadcrumbs.Styles.BREADCRUMB_ITEM + (await this.hasSiblings(uri) ? ' ' + Breadcrumbs.Styles.BREADCRUMB_ITEM_HAS_POPUP : '');
                this.filePathItems.push(new FileBreadcrumbItem(
                    label,
                    title,
                    icon,
                    uri,
                    itemCssClass,
                    this.fileSystem,
                    this.labelProvider,
                    this.openerService,
                    this.messageService
                ));
            }
        }
        this.refresh();
    }

    protected async updateOutlineItems(outlinePath: OutlineSymbolInformationNode[]): Promise<void> {
        this.outlineItems = outlinePath.map(node => new OutlineBreadcrumbItem(node, this.editor, this.outlineViewService));
        this.refresh();
    }

    dispose(): void {
        super.dispose();
        this.disposables.dispose();
        if (this.scrollbar) {
            this.scrollbar.destroy();
            this.scrollbar = undefined;
        }
    }

    refresh(): void {
        this.render();

        if (!this.scrollbar) {
            if (this.host.firstChild) {
                this.scrollbar = new PerfectScrollbar(this.host.firstChild as HTMLElement, {
                    handlers: ['drag-thumb', 'keyboard', 'wheel', 'touch'],
                    useBothWheelAxes: true,
                    scrollXMarginOffset: 4,
                    suppressScrollY: true
                });
            }
        } else {
            this.scrollbar.update();
        }
        this.scrollToEnd();
        if (this.disposables.disposed) {
            this.createOutlineChangeListener();
        }
    }

    onAfterShow(): void {
        this.createOutlineChangeListener();
    }

    private createOutlineChangeListener(): void {
        this.disposables.push(this.outlineViewService.onDidChangeOutline(roots => {
            if (this.editor.isFocused()) {
                const outlinePath = toOutlinePath(findSelectedNode(roots));
                if (outlinePath) { this.updateOutlineItems(outlinePath); }
            }
        }));

        this.disposables.push(this.outlineViewService.onDidSelect(node => {
            // Check if this event is for this editor (by comparing URIs)
            if (OutlineNodeWithUri.is(node) && node.uri.toString() === this.editor.uri.toString()) {
                const outlinePath = toOutlinePath(node);
                if (outlinePath) { this.updateOutlineItems(outlinePath); }
            }
        }));
    }

    onAfterHide(): void {
        this.disposables.dispose();
    }

    private scrollToEnd(): void {
        if (this.host.firstChild) {
            const breadcrumbsHtmlElement = (this.host.firstChild as HTMLElement);
            breadcrumbsHtmlElement.scrollLeft = breadcrumbsHtmlElement.scrollWidth;
        }
    }

    private async hasSiblings(uri: URI): Promise<boolean> {
        const fileStat = await this.fileSystem.getFileStat(uri.parent.toString());

        if (fileStat && fileStat.children) {
            const length = fileStat.children.filter(child => !child.isDirectory).filter(child => child.uri !== uri.toString()).length;
            return length > 0;
        }
        return false;
    }

    protected doRender(): React.ReactNode {
        return [
            <ul className={Breadcrumbs.Styles.BREADCRUMBS}>{this.renderItems()}</ul>,
            <div className={Breadcrumbs.Styles.BREADCRUMB_POPUP_CONTAINER}></div>
        ];
    }

    protected renderItems(): JSX.Element[] {
        return [...this.filePathItems, ...this.outlineItems].map((item, index) => item.render(index));
    }
}

export const BreadcrumbsRendererFactory = Symbol('BreadcrumbsRendererFactory');
export interface BreadcrumbsRendererFactory {
    (editor: TextEditor): BreadcrumbsRenderer;
}

interface OutlineNodeWithUri extends OutlineSymbolInformationNode {
    uri: URI;
}
namespace OutlineNodeWithUri {
    export function is(node: OutlineSymbolInformationNode): node is OutlineNodeWithUri {
        return 'uri' in node;
    }
}
