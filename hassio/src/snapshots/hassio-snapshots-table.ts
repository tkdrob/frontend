import "../../../src/components/ha-fab";
import "../../../src/layouts/hass-tabs-subpage-data-table";
import "@material/mwc-button";
import { mdiPlus } from "@mdi/js";
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
import { formatAsPaddedHex } from "../../../src/panels/config/integrations/integration-panels/zha/functions";
import { haStyle } from "../../../src/resources/styles";
import { HomeAssistant, Route } from "../../../src/types";
import { supervisorTabs } from "../hassio-tabs";
import relativeTime from "../../../src/common/datetime/relative_time";
import { showHassioSnapshotDialog } from "../dialogs/snapshot/show-dialog-hassio-snapshot";
import { Supervisor } from "../../../src/data/supervisor/supervisor";

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
      this._fetchSnapShots();
    }
  }

  protected firstUpdated(changedProperties: PropertyValues): void {
    super.firstUpdated(changedProperties);
    if (this.hass) {
      this._fetchSnapShots();
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
          filterable: true,
          template: (entry: string) => {
            return entry === "partial" ? "Partial" : "Full";
          },
        };
        collums.protected = {
          title: "Protected",
          width: "15%",
          sortable: true,
          filterable: true,
          template: (entry: boolean) => {
            return entry ? "True" : "False";
          },
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

  private async _fetchSnapShots() {
    await reloadHassioSnapshots(this.hass);
    this._snapshots = await fetchHassioSnapshots(this.hass);
  }

  private _handleRowClicked(ev: HASSDomEvent<RowClickedEvent>) {
    const slug = ev.detail.id;
    showHassioSnapshotDialog(this, {
      slug,
      supervisor: this.supervisor,
      onDelete: () => this._fetchSnapShots(),
    });
  }

  private _createSnapshot(ev: HASSDomEvent<RowClickedEvent>) {
    const groupId = ev.detail.id;
  }

  static get styles(): CSSResultArray {
    return [
      haStyle,
      css`
        a {
          color: var(--primary-color);
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
