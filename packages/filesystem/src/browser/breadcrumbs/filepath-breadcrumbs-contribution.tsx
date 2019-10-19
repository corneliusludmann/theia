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
import { FilepathBreadcrumb } from './filepath-breadcrumb';
import { injectable, inject } from 'inversify';
import { LabelProvider, OpenerService, BreadcrumbPopupContainerRenderer, BreadcrumbPopup } from '@theia/core/lib/browser';
import { FileSystem } from '../../common';
import URI from '@theia/core/lib/common/uri';

export const FilepathBreadcrumbType = Symbol('FilepathBreadcrumb');

@injectable()
export class FilepathBreadcrumbsContribution implements BreadcrumbsContribution {

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(FileSystem)
    protected readonly fileSystem: FileSystem;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(BreadcrumbPopupContainerRenderer)
    protected readonly breadcrumbPopupContainerRenderer: BreadcrumbPopupContainerRenderer;

    readonly type = FilepathBreadcrumbType;
    readonly priority: number = 100;

    async computeBreadcrumbs(uri: URI): Promise<Breadcrumb[]> {
        if (uri.scheme !== 'file') {
            return [];
        }
        return (await Promise.all(uri.allLocations.reverse()
            .map(async u => new FilepathBreadcrumb(
                u,
                this.labelProvider.getName(u),
                this.labelProvider.getLongName(u),
                await this.labelProvider.getIcon(u) + ' file-icon'
            )))).filter(b => this.filterBreadcrumbs(uri, b));
    }

    protected filterBreadcrumbs(_: URI, breadcrumb: FilepathBreadcrumb): boolean {
        return !breadcrumb.uri.path.isRoot;
    }

    async openPopup(breadcrumb: Breadcrumb, position: { x: number, y: number }, parent: HTMLElement): Promise<BreadcrumbPopup | undefined> {
        if (!FilepathBreadcrumb.is(breadcrumb)) {
            return undefined;
        }
        const folderFileStat = await this.fileSystem.getFileStat(breadcrumb.uri.parent.toString());

        if (folderFileStat && folderFileStat.children) {
            const items = await Promise.all(folderFileStat.children
                .filter(child => !child.isDirectory)
                .filter(child => child.uri !== breadcrumb.uri.toString())
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
                return this.breadcrumbPopupContainerRenderer.render(breadcrumb.id, position, this.renderItems(items), parent);
            }
        }
        return this.breadcrumbPopupContainerRenderer.render(breadcrumb.id, position, <div style={{ margin: '.5rem' }}>No siblings.</div>, parent);
    }

    protected renderItems(items: { label: string, title: string, iconClass: string, action: () => void }[]): React.ReactNode {
        return <ul>
            {items.map((item, index) => <li key={index} title={item.title} onClick={_ => item.action()}>
                <span className={item.iconClass}></span> <span>{item.label}</span>
            </li>)}
        </ul>;
    }

    protected openFile = (uri: URI) => {
        this.openerService.getOpener(uri)
            .then(opener => opener.open(uri));
    }
}
