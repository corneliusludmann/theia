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
import { Breadcrumbs } from './breadcrumbs';
import URI from '@theia/core/lib/common/uri';
import { FileSystem } from '@theia/filesystem/lib/common';
import { LabelProvider, OpenerService } from '@theia/core/lib/browser';
import { MessageService } from '@theia/core';
import { BreadcrumbsListPopup } from './breadcrumbs-popups';
import { findParentBreadcrumbsHtmlElement, determinePopupAnchor } from './breadcrumbs-utils';
import { OutlineSymbolInformationNode } from '@theia/outline-view/lib/browser';
import { TextEditor, Range } from '../editor';
import { OutlineViewService } from '@theia/outline-view/lib/browser/outline-view-service';

export interface BreadcrumbItem {
    render(index: number): JSX.Element;
}

export class SimpleBreadcrumbItem implements BreadcrumbItem {
    constructor(readonly text: string) { }
    render(index: number): JSX.Element {
        return <li key={index} title={this.text} className={Breadcrumbs.Styles.BREADCRUMB_ITEM}>
            {this.text}
        </li>;
    }
}

abstract class BreadcrumbItemWithPopup implements BreadcrumbItem {

    protected popup: BreadcrumbsListPopup | undefined;

    abstract render(index: number): JSX.Element;

    protected showPopup = (event: React.MouseEvent) => {
        if (this.popup) {
            // Popup already shown. Hide popup instead.
            this.popup.dispose();
            this.popup = undefined;
        } else {
            if (event.nativeEvent.target && event.nativeEvent.target instanceof HTMLElement) {
                const breadcrumbsHtmlElement = findParentBreadcrumbsHtmlElement(event.nativeEvent.target as HTMLElement);
                if (breadcrumbsHtmlElement && breadcrumbsHtmlElement.parentElement && breadcrumbsHtmlElement.parentElement.lastElementChild) {
                    const parentElement = breadcrumbsHtmlElement.parentElement.lastElementChild;
                    if (!parentElement.classList.contains(Breadcrumbs.Styles.BREADCRUMB_POPUP_CONTAINER)) {
                        // this is unexpected
                    } else {
                        const anchor: { x: number, y: number } = determinePopupAnchor(event.nativeEvent) || event.nativeEvent;
                        this.createPopup(parentElement as HTMLElement, anchor).then(popup => { this.popup = popup; });
                        event.stopPropagation();
                        event.preventDefault();
                    }
                }
            }
        }
    }

    protected abstract async createPopup(parent: HTMLElement, anchor: { x: number, y: number }): Promise<BreadcrumbsListPopup | undefined>;
}

export class FileBreadcrumbItem extends BreadcrumbItemWithPopup {

    constructor(
        readonly text: string,
        readonly title: string = text,
        readonly icon: string,
        readonly uri: URI,
        readonly itemCssClass: string,
        protected readonly fileSystem: FileSystem,
        protected readonly labelProvider: LabelProvider,
        protected readonly openerService: OpenerService,
        protected readonly messageService: MessageService,
    ) { super(); }

    render(index: number): JSX.Element {
        return <li key={index} title={this.title}
            className={this.itemCssClass}
            onClick={this.showPopup}
        >
            <span className={this.icon + ' file-icon'}></span> <span>{this.text}</span>
        </li>;
    }

    protected async createPopup(parent: HTMLElement, anchor: { x: number, y: number }): Promise<BreadcrumbsListPopup | undefined> {

        const folderFileStat = await this.fileSystem.getFileStat(this.uri.parent.toString());

        if (folderFileStat && folderFileStat.children) {
            const items = await Promise.all(folderFileStat.children
                .filter(child => !child.isDirectory)
                .filter(child => child.uri !== this.uri.toString())
                .map(child => new URI(child.uri))
                .map(
                    async u => ({
                        label: this.labelProvider.getName(u),
                        title: this.labelProvider.getLongName(u),
                        iconClass: await this.labelProvider.getIcon(u) + ' file-icon',
                        action: () => this.openFile(u)
                    })
                ));
            if (items.length > 0) {
                const filelistPopup = new BreadcrumbsListPopup(items, anchor, parent);
                filelistPopup.render();
                return filelistPopup;
            }
        }
    }

    protected openFile = (uri: URI) => {
        this.openerService.getOpener(uri)
            .then(opener => opener.open(uri))
            .catch(error => this.messageService.error(error));
    }
}

export class OutlineBreadcrumbItem extends BreadcrumbItemWithPopup {

    constructor(
        protected readonly node: OutlineSymbolInformationNode,
        protected readonly editor: TextEditor,
        protected readonly outlineViewService: OutlineViewService
    ) { super(); }

    render(index: number): JSX.Element {
        return <li key={index} title={this.node.name}
            className={Breadcrumbs.Styles.BREADCRUMB_ITEM + (this.hasPopup() ? ' ' + Breadcrumbs.Styles.BREADCRUMB_ITEM_HAS_POPUP : '')}
            onClick={this.showPopup}
        >
            <span className={'symbol-icon symbol-icon-center ' + this.node.iconClass}></span> <span>{this.node.name}</span>
        </li>;
    }

    protected async createPopup(parent: HTMLElement, anchor: { x: number, y: number }): Promise<BreadcrumbsListPopup | undefined> {
        const items = this.siblings().map(node => ({
            label: node.name,
            title: node.name,
            iconClass: 'symbol-icon symbol-icon-center ' + this.node.iconClass,
            action: () => this.revealInEditor(node)
        }));
        if (items.length > 0) {
            const filelistPopup = new BreadcrumbsListPopup(items, anchor, parent);
            filelistPopup.render();
            return filelistPopup;
        }
    }

    private revealInEditor(node: OutlineSymbolInformationNode): void {
        if (OutlineNodeWithRange.is(node)) {
            this.editor.cursor = node.range.end;
            this.editor.selection = node.range;
            this.editor.revealRange(node.range);
            this.editor.focus();
        }
    }

    private hasPopup(): boolean {
        return this.siblings().length > 0;
    }

    private siblings(): OutlineSymbolInformationNode[] {
        if (!this.node.parent) { return []; }
        return this.node.parent.children.filter(n => n !== this.node).map(n => n as OutlineSymbolInformationNode);
    }
}

interface OutlineNodeWithRange extends OutlineSymbolInformationNode {
    range: Range;
}
namespace OutlineNodeWithRange {
    export function is(node: OutlineSymbolInformationNode): node is OutlineNodeWithRange {
        return 'range' in node;
    }
}
