import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';
import { Incident } from '../../core/models';

@Component({
  selector: 'app-incident-location-map',
  standalone: true,
  templateUrl: './incident-location-map.html',
  styleUrl: './incident-location-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentLocationMapComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) incident!: Incident;

  private map?: L.Map;
  private markerLayer?: L.LayerGroup;

  @ViewChild('mapContainer')
  set mapContainer(element: ElementRef<HTMLElement> | undefined) {
    if (element && !this.map) this.initializeMap(element.nativeElement);
  }

  ngOnChanges() {
    queueMicrotask(() => this.renderLocation());
  }

  ngOnDestroy() {
    this.map?.remove();
    this.map = undefined;
  }

  private initializeMap(container: HTMLElement) {
    this.map = L.map(container, {
      center: [13.7563, 100.5018],
      zoom: 15,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      keyboard: true,
      zoomControl: true,
    });
    L.tileLayer(environment.mapTileUrl, {
      attribution: environment.mapAttribution,
      maxZoom: 19,
    }).addTo(this.map);
    this.markerLayer = L.layerGroup().addTo(this.map);
    this.renderLocation();
    queueMicrotask(() => this.map?.invalidateSize());
  }

  private renderLocation() {
    if (!this.map || !this.markerLayer || !this.incident) return;
    const latitude = Number(this.incident.latitude);
    const longitude = Number(this.incident.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const location = L.latLng(latitude, longitude);
    this.markerLayer.clearLayers();
    L.marker(location, {
      title: this.incident.caseCode,
      keyboard: true,
      icon: L.divIcon({
        className: 'incident-map-marker selected',
        html: '<span aria-hidden="true"></span>',
        iconSize: [34, 42],
        iconAnchor: [17, 40],
      }),
    })
      .bindTooltip(this.incident.caseCode, { direction: 'top', offset: [0, -34] })
      .addTo(this.markerLayer);
    this.map.setView(location, 15, { animate: false });
    this.map.invalidateSize();
  }
}
