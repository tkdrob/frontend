import "@material/mwc-list/mwc-list-item";
import "../../../src/components/ha-button-menu";
import "../../../src/components/ha-fab";
import "../../../src/layouts/hass-tabs-subpage-data-table";
import "@material/mwc-button";
import { mdiDelete, mdiDotsVertical, mdiDownload, mdiPlus } from "@mdi/js";
import {
  css,
  CSSResultArray,
  customElement,
  html,
  LitElement,
  property,
  PropertyValues,
  TemplateResult,
} from "lit-element";
import memoizeOne from "memoize-one";
import { HASSDomEvent } from "../../../src/common/dom/fire_event";
import {
  DataTableColumnContainer,
  RowClickedEvent,
} from "../../../src/components/data-table/ha-data-table";
import {
  fetchHassioSnapshots,
  HassioSnapshot,
  reloadHassioSnapshots,
} from "../../../src/data/hassio/snapshot";
import { haStyle } from "../../../src/resources/styles";
import { HomeAssistant, Route } from "../../../src/types";
import { supervisorTabs } from "../hassio-tabs";
import relativeTime from "../../../src/common/datetime/relative_time";
import { showHassioSnapshotDialog } from "../dialogs/snapshot/show-dialog-hassio-snapshot";
import { Supervisor } from "../../../src/data/supervisor/supervisor";
import { atLeastVersion } from "../../../src/common/config/version";
import { ActionDetail } from "@material/mwc-list";
import { showSnapshotUploadDialog } from "../dialogs/snapshot/show-dialog-snapshot-upload";
import { extractApiErrorMessage } from "../../../src/data/hassio/common";
import { showConfirmationDialog } from "../../../src/dialogs/generic/show-dialog-box";

@customElement("hassio-snapshots-table")
export class HassioSnapshotsTable extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public supervisor!: Supervisor;

  @property({ type: Object }) public route!: Route;

  @property({ type: Boolean }) public narrow!: boolean;

  @property({ type: Boolean }) public isWide!: boolean;

  @property({ attribute: false }) public _snapshots: HassioSnapshot[] = [];

  private _firstUpdatedCalled = false;

  public connectedCallback(): void {
    super.connectedCallback();
    if (this.hass && this._firstUpdatedCalled) {
      this.refreshData();
    }
  }

  public async refreshData() {
    await reloadHassioSnapshots(this.hass);
    await this._fetchSnapshots();
  }

  protected firstUpdated(changedProperties: PropertyValues): void {
    super.firstUpdated(changedProperties);
    if (this.hass) {
      this.refreshData();
    }
    this._firstUpdatedCalled = true;
  }

  private _columns = memoizeOne(
    (narrow: boolean): DataTableColumnContainer => {
      const collums: Record<string, any> = {
        name: {
          title: "Name",
          sortable: true,
          filterable: true,
          grows: true,
        },
      };
      if (!narrow) {
        collums.date = {
          title: "Created",
          width: "15%",
          direction: "desc",
          sortable: true,
          template: (entry: string) => {
            return relativeTime(new Date(entry), this.hass.localize);
          },
        };
        collums.type = {
          title: "Type",
          width: "15%",
          sortable: true,
          template: (entry: string) => {
            return entry === "partial" ? "Partial" : "Full";
          },
        };
        collums.icon_download = {
          title: "",
          type: "icon",
          width: "64px",
          template: () => html`
            <div tabindex="0" style="display:inline-block; position: relative;">
              <mwc-icon-button @click=${this._downloadClicked}>
                <ha-svg-icon .path=${mdiDownload}></ha-svg-icon>
              </mwc-icon-button>
              <paper-tooltip animation-delay="0" position="left">
                Download snapshot
              </paper-tooltip>
            </div>
          `,
        };
        collums.icon_delete = {
          title: "",
          type: "icon",
          width: "64px",
          template: () => html`
            <div tabindex="0" style="display:inline-block; position: relative;">
              <mwc-icon-button @click=${this._deleteClicked}>
                <ha-svg-icon
                  style="color: var(--error-color)"
                  .path=${mdiDelete}
                >
                </ha-svg-icon>
              </mwc-icon-button>
              <paper-tooltip animation-delay="0" position="left">
                Delete snapshot
              </paper-tooltip>
            </div>
          `,
        };
      }
      return collums;
    }
  );

  protected render(): TemplateResult {
    return html`
      <hass-tabs-subpage-data-table
        .tabs=${supervisorTabs}
        .hass=${this.hass}
        .narrow=${this.narrow}
        .route=${this.route}
        .columns=${this._columns(this.narrow)}
        .data=${this._snapshots}
        id="slug"
        @row-click=${this._handleRowClicked}
        clickable
        hasFab
      >
        <ha-button-menu
          corner="BOTTOM_START"
          slot="toolbar-icon"
          @action=${this._handleAction}
        >
          <mwc-icon-button slot="trigger" alt="menu">
            <ha-svg-icon .path=${mdiDotsVertical}></ha-svg-icon>
          </mwc-icon-button>
          <mwc-list-item>
            Reload
          </mwc-list-item>
          ${atLeastVersion(this.hass.config.version, 0, 116)
            ? html`<mwc-list-item>
                Upload snapshot
              </mwc-list-item>`
            : ""}
        </ha-button-menu>
        <ha-fab
          slot="fab"
          @click=${this._createSnapshot}
          label="Create snapshot"
          extended
        >
          <ha-svg-icon slot="icon" .path=${mdiPlus}></ha-svg-icon>
        </ha-fab>
      </hass-tabs-subpage-data-table>
    `;
  }

  private _handleAction(ev: CustomEvent<ActionDetail>) {
    switch (ev.detail.index) {
      case 0:
        this.refreshData();
        break;
      case 1:
        this._showUploadSnapshotDialog();
        break;
    }
  }

  private _showUploadSnapshotDialog() {
    showSnapshotUploadDialog(this, {
      showSnapshot: (slug: string) =>
        showHassioSnapshotDialog(this, {
          slug,
          supervisor: this.supervisor,
          onDelete: () => this._fetchSnapshots(),
        }),
      reloadSnapshot: () => this.refreshData(),
    });
  }

  private async _fetchSnapshots() {
    await reloadHassioSnapshots(this.hass);
    this._snapshots = await fetchHassioSnapshots(this.hass);
  }

  private _handleRowClicked(ev: HASSDomEvent<RowClickedEvent>) {
    console.log(ev.currentTarget);
    return;
    const slug = ev.detail.id;
    showHassioSnapshotDialog(this, {
      slug,
      supervisor: this.supervisor,
      onDelete: () => this._fetchSnapshots(),
    });
  }

  private _createSnapshot(ev: HASSDomEvent<RowClickedEvent>) {
    const groupId = ev.detail.id;
  }

  private async _downloadClicked(ev: Event) {
    ev.stopPropagation();
    let signedPath: { path: string };
    try {
      signedPath = await getSignedPath(
        this.hass,
        `/api/hassio/snapshots/${this._snapshot!.slug}/download`
      );
    } catch (err) {
      alert(`Error: ${extractApiErrorMessage(err)}`);
      return;
    }

    if (window.location.href.includes("ui.nabu.casa")) {
      const confirm = await showConfirmationDialog(this, {
        title: "Potential slow download",
        text:
          "Downloading snapshots over the Nabu Casa URL will take some time, it is recomended to use your local URL instead, do you want to continue?",
        confirmText: "continue",
        dismissText: "cancel",
      });
      if (!confirm) {
        return;
      }
    }

    const name = this._computeName.replace(/[^a-z0-9]+/gi, "_");
    const a = document.createElement("a");
    a.href = signedPath.path;
    a.download = `Hass_io_${name}.tar`;
    this.shadowRoot!.appendChild(a);
    a.click();
    this.shadowRoot!.removeChild(a);
  }

  private async _deleteClicked(ev: Event) {
    ev.stopPropagation();
    if (
      !(await showConfirmationDialog(this, {
        title: "Are you sure you want to delete this snapshot?",
        confirmText: "delete",
        dismissText: "cancel",
      }))
    ) {
      return;
    }
    this.hass
      .callApi("POST", `hassio/snapshots/${this._snapshot!.slug}/remove`)
      .then(
        () => {
          if (this._dialogParams!.onDelete) {
            this._dialogParams!.onDelete();
          }
          this._closeDialog();
        },
        (error) => {
          this._error = error.body.message;
        }
      );
  }
  static get styles(): CSSResultArray {
    return [
      haStyle,
      css`
        a {
          color: var(--primary-color);
        }

        mwc-icon-button.warning {
          color: var(--error-color);
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hassio-snapshots-table": HassioSnapshotsTable;
  }
}
