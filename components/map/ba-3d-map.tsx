"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ArrowUpRight,
  Compass,
  MapPin,
  MousePointer2,
  Pause,
  Play,
  Route,
} from "lucide-react";
import { DEVELOPMENT_STATUS_LABELS, Development, DevelopmentStatus } from "@/types";
import { formatPrice } from "@/lib/utils";

type MapDevelopment = Pick<
  Development,
  | "id"
  | "name"
  | "slug"
  | "location"
  | "address"
  | "status"
  | "completionDate"
  | "progress"
  | "availableUnits"
  | "minPriceAvailable"
  | "priceFrom"
>;

type PositionedDevelopment = MapDevelopment & {
  neighborhood: string;
  x: number;
  z: number;
};

const NEIGHBORHOODS = [
  { name: "Puerto Madero", label: "PUERTO MADERO", x: 10.8, z: 8.4, radius: 2.9, color: "#203c3e" },
  { name: "Retiro", label: "RETIRO", x: 6.3, z: 5.3, radius: 2.6, color: "#263832" },
  { name: "Recoleta", label: "RECOLETA", x: 1.4, z: 2.2, radius: 2.9, color: "#273b31" },
  { name: "Palermo", label: "PALERMO", x: -5.6, z: -1.9, radius: 4.6, color: "#2a4437" },
  { name: "Belgrano", label: "BELGRANO", x: -13.4, z: -6.3, radius: 3.8, color: "#243f36" },
  { name: "Nunez", label: "NUÑEZ", x: -20, z: -10.2, radius: 3.2, color: "#1f3934" },
];

type Neighborhood = (typeof NEIGHBORHOODS)[number];

const POSITION_HINTS: Record<string, { x: number; z: number; neighborhood: string }> = {
  madero: { x: 10.8, z: 8.4, neighborhood: "Puerto Madero" },
  retiro: { x: 6.3, z: 5.3, neighborhood: "Retiro" },
  catalinas: { x: 6.8, z: 5.8, neighborhood: "Retiro" },
  recoleta: { x: 1.4, z: 2.2, neighborhood: "Recoleta" },
  palermo: { x: -5.6, z: -1.9, neighborhood: "Palermo" },
  belgrano: { x: -13.4, z: -6.3, neighborhood: "Belgrano" },
  aguilar: { x: -12.8, z: -6.8, neighborhood: "Belgrano" },
  libertador: { x: -18.5, z: -9.4, neighborhood: "Nunez" },
  nunez: { x: -20, z: -10.2, neighborhood: "Nunez" },
  "nuñez": { x: -20, z: -10.2, neighborhood: "Nunez" },
};

const AERIAL_HOME_TARGET = new THREE.Vector3(0.8, 0, 2.8);
const AERIAL_HOME_CAMERA = new THREE.Vector3(-6.8, 38, 22);
const AERIAL_FOCUS_OFFSET = new THREE.Vector3(-3.2, 28, 10.5);

function getPosition(dev: MapDevelopment, index: number): PositionedDevelopment {
  const source = `${dev.name} ${dev.location} ${dev.address}`.toLowerCase();
  const hint = Object.entries(POSITION_HINTS).find(([key]) => source.includes(key))?.[1];
  const fallback = NEIGHBORHOODS[index % NEIGHBORHOODS.length];
  const base = hint || { x: fallback.x, z: fallback.z, neighborhood: fallback.name };
  const spread = hint ? 1.2 : 2.2;
  const angle = index * 1.9;

  return {
    ...dev,
    x: base.x + Math.cos(angle) * spread,
    z: base.z + Math.sin(angle) * spread,
    neighborhood: base.neighborhood,
  };
}

function createTextSprite(text: string, color = "#f4eadc") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  canvas.width = 512;
  canvas.height = 128;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "600 40px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(10,10,11,0.62)";
  context.fillRect(28, 28, 456, 72);
  context.strokeStyle = "rgba(244,234,220,0.24)";
  context.strokeRect(28, 28, 456, 72);
  context.fillStyle = color;
  context.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.8, 0.95, 1);
  return sprite;
}

function addNeighborhoodTerrace(
  scene: THREE.Scene,
  x: number,
  z: number,
  radius: number,
  color: string
) {
  const geometry = new THREE.CircleGeometry(radius, 48);
  geometry.scale(1.45, 0.72, 1);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -0.57;
  mesh.position.set(x, 0.025, z);
  scene.add(mesh);
  return mesh;
}

function addRoad(scene: THREE.Scene, points: THREE.Vector3[], color = "#d5c7b2") {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 64, 0.055, 8, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.04,
    roughness: 0.72,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  return mesh;
}

function addFlatRect(
  scene: THREE.Scene,
  x: number,
  z: number,
  width: number,
  depth: number,
  color: string,
  y = 0.065,
  rotation = -0.57
) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotation;
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

function addReferenceMapTexture(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const texture = new THREE.TextureLoader().load("/maps/puerto-madero-base.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(29, 21.4), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -0.57;
  mesh.position.set(2.6, 0.052, 4.2);
  scene.add(mesh);
  return mesh;
}

function addUrbanGrid(scene: THREE.Scene) {
  for (let x = -24; x <= 8.6; x += 1.25) {
    addFlatRect(scene, x, -2.2, 0.08, 31, "#c8cdd0", 0.075);
  }

  for (let z = -15.8; z <= 10.8; z += 1.25) {
    addFlatRect(scene, -7.7, z, 35, 0.08, "#c8cdd0", 0.076);
  }

  [
    { x: -20.8, z: -10.8, width: 0.32, depth: 16.5 },
    { x: -15.8, z: -7.8, width: 0.3, depth: 20.5 },
    { x: -10.8, z: -5.8, width: 0.28, depth: 24.5 },
    { x: -3.2, z: -0.8, width: 0.24, depth: 24.5 },
    { x: 3.2, z: 3.1, width: 0.26, depth: 20.5 },
    { x: 7.8, z: 5.9, width: 0.32, depth: 15 },
  ].forEach((road) => {
    addFlatRect(scene, road.x, road.z, road.width, road.depth, "#6f777a", 0.09);
    addFlatRect(scene, road.x, road.z, 0.035, road.depth, "#e7c75f", 0.095);
  });

  [
    { x: -16.5, z: -12.8, width: 18, depth: 0.24 },
    { x: -11.2, z: -9.8, width: 24, depth: 0.24 },
    { x: -5.2, z: -7.6, width: 30, depth: 0.24 },
    { x: -1.4, z: -2.7, width: 27, depth: 0.22 },
    { x: 2.2, z: 2.1, width: 21, depth: 0.24 },
    { x: 6.4, z: 6.8, width: 14, depth: 0.28 },
  ].forEach((road) => {
    addFlatRect(scene, road.x, road.z, road.width, road.depth, "#747b7d", 0.09);
  });
}

function addRiver(scene: THREE.Scene) {
  const shape = new THREE.Shape();
  shape.moveTo(7.8, -17);
  shape.bezierCurveTo(10.8, -10.5, 12.4, -4.5, 13.7, 1.8);
  shape.bezierCurveTo(14.8, 7.6, 16.8, 12.5, 20.6, 17);
  shape.lineTo(27, 17);
  shape.lineTo(27, -17);
  shape.lineTo(7.8, -17);

  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshStandardMaterial({
    color: "#9fc4d3",
    roughness: 0.22,
    metalness: 0.04,
    transparent: true,
    opacity: 0.96,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.035;
  scene.add(mesh);
}

function addPuertoMaderoDocks(scene: THREE.Scene) {
  const water = "#a7c6cf";
  [
    { x: 7.7, z: 4.1, width: 1.05, depth: 3.8 },
    { x: 8.4, z: 6.7, width: 1.1, depth: 4.1 },
    { x: 9.2, z: 9.3, width: 1.0, depth: 3.5 },
  ].forEach((dock) => {
    addFlatRect(scene, dock.x, dock.z, dock.width, dock.depth, water, 0.082);
    addFlatRect(scene, dock.x - 0.68, dock.z, 0.08, dock.depth + 0.5, "#e8e8e3", 0.095);
    addFlatRect(scene, dock.x + 0.68, dock.z, 0.08, dock.depth + 0.5, "#e8e8e3", 0.095);
  });

  addFlatRect(scene, 8.8, 7.1, 0.22, 8.8, "#6b7072", 0.1);
  addFlatRect(scene, 7.1, 5.9, 0.24, 8.2, "#6b7072", 0.1);
}

function addPortAndRail(scene: THREE.Scene) {
  [
    { x: 5.9, z: 12.4, width: 7.4, depth: 1.1 },
    { x: 9.8, z: 13.8, width: 4.6, depth: 0.92 },
    { x: 12.9, z: 14.7, width: 3.8, depth: 0.75 },
  ].forEach((dock) => {
    addFlatRect(scene, dock.x, dock.z, dock.width, dock.depth, "#c7c8bd", 0.09);
    addFlatRect(scene, dock.x, dock.z + 0.55, dock.width * 0.78, 0.08, "#6a7174", 0.105);
  });

  for (let i = 0; i < 8; i += 1) {
    addRoad(
      scene,
      [
        new THREE.Vector3(-3.5 - i * 0.36, 0.14, 11.4 + i * 0.1),
        new THREE.Vector3(1.2 - i * 0.18, 0.14, 11.8 + i * 0.18),
        new THREE.Vector3(5.7, 0.14, 12.7 + i * 0.12),
      ],
      i % 2 === 0 ? "#d9a735" : "#a87d24"
    );
  }

  for (let i = 0; i < 7; i += 1) {
    addRoad(
      scene,
      [
        new THREE.Vector3(11.5, 0.08, -11 + i * 3.2),
        new THREE.Vector3(16.5, 0.08, -9.8 + i * 3.05),
        new THREE.Vector3(23.5, 0.08, -8.8 + i * 2.8),
      ],
      "#d7eef3"
    );
  }
}

function addEcologicalReserve(scene: THREE.Scene) {
  const reserveShape = new THREE.Shape();
  reserveShape.moveTo(9.4, 1.4);
  reserveShape.bezierCurveTo(12.4, 0.2, 16.8, 1.1, 19.2, 4.7);
  reserveShape.lineTo(20.9, 11.2);
  reserveShape.bezierCurveTo(17.5, 13.5, 13.2, 13.2, 10.4, 10.2);
  reserveShape.bezierCurveTo(8.7, 7.4, 8.4, 4.1, 9.4, 1.4);

  const reserve = new THREE.Mesh(
    new THREE.ShapeGeometry(reserveShape),
    new THREE.MeshStandardMaterial({
      color: "#6f8f55",
      roughness: 0.9,
      metalness: 0.01,
    })
  );
  reserve.rotation.x = -Math.PI / 2;
  reserve.position.y = 0.07;
  scene.add(reserve);

  [
    { x: 14.1, z: 5.5, sx: 2.2, sz: 1.05, rotation: -0.24 },
    { x: 16.4, z: 9.6, sx: 2.6, sz: 1.2, rotation: 0.35 },
  ].forEach((lagoon) => {
    const geometry = new THREE.CircleGeometry(1, 48);
    geometry.scale(lagoon.sx, lagoon.sz, 1);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: "#8db8c4",
        roughness: 0.32,
        metalness: 0.03,
        transparent: true,
        opacity: 0.82,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = lagoon.rotation;
    mesh.position.set(lagoon.x, 0.095, lagoon.z);
    scene.add(mesh);
  });

  addRoad(
    scene,
    [
      new THREE.Vector3(9.8, 0.13, 1.7),
      new THREE.Vector3(13.8, 0.13, 2.1),
      new THREE.Vector3(18.8, 0.13, 5.4),
      new THREE.Vector3(19.6, 0.13, 10.6),
      new THREE.Vector3(14.2, 0.13, 12.2),
      new THREE.Vector3(10.2, 0.13, 9.3),
    ],
    "#dce2d3"
  );
}

function addCoastline(scene: THREE.Scene) {
  addRoad(
    scene,
    [
      new THREE.Vector3(-22.8, 0.12, -14.0),
      new THREE.Vector3(-18.2, 0.12, -11.4),
      new THREE.Vector3(-15.4, 0.12, -9.6),
      new THREE.Vector3(-10.5, 0.12, -6.8),
      new THREE.Vector3(-5.8, 0.12, -3.6),
      new THREE.Vector3(-1.2, 0.12, -0.9),
      new THREE.Vector3(4.8, 0.12, 3.2),
      new THREE.Vector3(9.5, 0.12, 7.6),
      new THREE.Vector3(13.2, 0.12, 10.8),
    ],
    "#efe3cf"
  );

  addRoad(
    scene,
    [
      new THREE.Vector3(-22.0, 0.13, -15.0),
      new THREE.Vector3(-17.2, 0.13, -12.0),
      new THREE.Vector3(-14, 0.13, -10.8),
      new THREE.Vector3(-8.5, 0.13, -7.4),
      new THREE.Vector3(-2.6, 0.13, -3.8),
      new THREE.Vector3(2.8, 0.13, -0.5),
      new THREE.Vector3(8.4, 0.13, 4.8),
      new THREE.Vector3(12.1, 0.13, 8.8),
    ],
    "#a8c7c2"
  );
}

function addParks(scene: THREE.Scene) {
  const parkMaterial = new THREE.MeshStandardMaterial({
    color: "#5f9858",
    roughness: 0.88,
    metalness: 0.02,
    transparent: true,
    opacity: 0.95,
  });

  [
    { x: -2.8, z: -1.4, sx: 5.7, sz: 1.45, rotation: -0.57 },
    { x: -9.8, z: -6, sx: 3.8, sz: 1.2, rotation: -0.57 },
    { x: -16.8, z: -9.5, sx: 4.8, sz: 1.35, rotation: -0.57 },
    { x: -21.2, z: -12.7, sx: 3.4, sz: 1.05, rotation: -0.57 },
    { x: 5.2, z: 3.6, sx: 2.3, sz: 1.0, rotation: -0.57 },
    { x: 9.4, z: 8.9, sx: 2.3, sz: 1.1, rotation: -0.62 },
  ].forEach((park) => {
    const geometry = new THREE.CircleGeometry(1, 48);
    geometry.scale(park.sx, park.sz, 1);
    const mesh = new THREE.Mesh(geometry, parkMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = park.rotation;
    mesh.position.set(park.x, 0.055, park.z);
    scene.add(mesh);
  });

  const treeMaterial = new THREE.MeshStandardMaterial({ color: "#348344", roughness: 0.75 });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#7a6041", roughness: 0.8 });
  for (let i = 0; i < 210; i += 1) {
    const band = i % 4;
    const x =
      band === 0
        ? -3.8 + Math.sin(i * 1.7) * 2.8
        : band === 1
          ? -11.5 + Math.sin(i) * 4.8
          : band === 2
            ? -20.1 + Math.sin(i * 1.5) * 2.0
            : 9.5 + Math.sin(i * 1.2) * 1.7;
    const z =
      band === 0
        ? -1.5 + Math.cos(i * 1.3) * 0.85
        : band === 1
          ? -7.8 + Math.cos(i * 1.4) * 1.2
          : band === 2
            ? -12.2 + Math.cos(i * 1.3) * 0.85
            : 8.6 + Math.cos(i) * 1.2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 6), trunkMaterial);
    trunk.position.set(x, 0.17, z);
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), treeMaterial);
    crown.position.set(x, 0.34, z);
    scene.add(crown);
  }
}

function addBuildings(scene: THREE.Scene) {
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: "#f3f4f2",
    roughness: 0.64,
    metalness: 0.02,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: "#dfe4e5",
    roughness: 0.58,
    metalness: 0.04,
  });
  const towerMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.48,
    metalness: 0.05,
  });

  for (let x = -24; x <= 9.2; x += 0.62) {
    for (let z = -16.2; z <= 10.6; z += 0.62) {
      const riverEdge = x > 5.2 && z > x * 0.74 + 2.2;
      const inPalermoPark = x > -7.2 && x < 0.5 && z > -4.5 && z < 1.2;
      const inBelgranoPark = x > -18.8 && x < -11.8 && z > -10.8 && z < -5.6;
      const inNunezPark = x > -22.8 && x < -18.0 && z > -14.3 && z < -10.6;
      const inDocks = x > 6.5 && x < 10.2 && z > 2.1 && z < 11.1;
      const skip =
        riverEdge ||
        inPalermoPark ||
        inBelgranoPark ||
        inNunezPark ||
        inDocks ||
        Math.abs(Math.sin(x * 3.1)) < 0.08 ||
        Math.abs(Math.cos(z * 2.9)) < 0.08 ||
        Math.sin(x * 6.7 + z * 5.1) > 0.93;
      if (skip) continue;

      const height = 0.1 + Math.abs(Math.sin(x * 1.2) + Math.cos(z * 1.4)) * 0.24;
      const maderoBoost = x > 5.7 && z > 3.2 ? 2.75 : 1;
      const belgranoBoost = x < -10.5 && x > -18.8 && z < -4.2 ? 1.62 : 1;
      const nunezBoost = x < -18 && z < -9.4 ? 1.45 : 1;
      const palermoBoost = x > -7.2 && x < 0.8 ? 1.25 : 1;
      const boost = Math.max(maderoBoost, belgranoBoost, nunezBoost, palermoBoost);
      const geometry = new THREE.BoxGeometry(0.5, height * boost, 0.5);
      const mesh = new THREE.Mesh(
        geometry,
        boost > 1.7 && Math.sin(x + z) > 0.1 ? accentMaterial : buildingMaterial
      );
      mesh.rotation.y = -0.55;
      mesh.position.set(x, (height * boost) / 2, z);
      scene.add(mesh);
    }
  }

  [
    { x: 8.8, z: 4.2, h: 2.9 },
    { x: 9.4, z: 5.3, h: 3.4 },
    { x: 10.2, z: 7.1, h: 3.1 },
    { x: 9.8, z: 8.5, h: 3.7 },
    { x: 7.3, z: 5.1, h: 2.4 },
    { x: 6.6, z: 6.4, h: 2.7 },
    { x: -10.6, z: -5.2, h: 2.0 },
    { x: -12.2, z: -7.0, h: 2.2 },
    { x: -14.4, z: -6.8, h: 2.4 },
    { x: -17.6, z: -9.5, h: 2.2 },
    { x: -20.2, z: -10.4, h: 2.1 },
    { x: -21.6, z: -11.5, h: 1.85 },
  ].forEach((tower) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, tower.h, 0.48), towerMaterial);
    mesh.rotation.y = -0.55;
    mesh.position.set(tower.x, tower.h / 2, tower.z);
    scene.add(mesh);
  });
}

function statusColor(status: DevelopmentStatus) {
  if (status === "en_construccion") return "#d7a65f";
  if (status === "pre_venta") return "#8fb9ff";
  if (status === "finalizado") return "#89d4ad";
  return "#d9ccba";
}

interface BuenosAires3DMapProps {
  developments: MapDevelopment[];
}

export function BuenosAires3DMap({ developments }: BuenosAires3DMapProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const desiredCameraRef = useRef(AERIAL_HOME_CAMERA.clone());
  const desiredTargetRef = useRef(AERIAL_HOME_TARGET.clone());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(true);
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [sceneStatus, setSceneStatus] = useState<"idle" | "starting" | "ready" | "error">("idle");
  const [sceneError, setSceneError] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const hoveredIdRef = useRef<string | null>(null);

  const positioned = useMemo(
    () => developments.map((dev, index) => getPosition(dev, index)),
    [developments]
  );
  const active = positioned.find((dev) => dev.id === activeId) || null;

  const focusOn = useCallback((x: number, z: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    desiredTargetRef.current.set(x, 0.18, z);
    desiredCameraRef.current.set(
      x + AERIAL_FOCUS_OFFSET.x,
      AERIAL_FOCUS_OFFSET.y,
      z + AERIAL_FOCUS_OFFSET.z
    );
  }, []);

  const showFullCorridor = useCallback(() => {
    desiredTargetRef.current.copy(AERIAL_HOME_TARGET);
    desiredCameraRef.current.copy(AERIAL_HOME_CAMERA);
  }, []);

  const focusDevelopment = useCallback(
    (dev: PositionedDevelopment) => {
      setIntroOpen(false);
      setTourActive(false);
      setActiveId(dev.id);
      focusOn(dev.x, dev.z);
    },
    [focusOn]
  );

  const focusZone = useCallback(
    (zone: Neighborhood, keepTour = false) => {
      setIntroOpen(false);
      if (!keepTour) setTourActive(false);
      const target = positioned.find((dev) => dev.neighborhood === zone.name);
      if (target) setActiveId(target.id);
      focusOn(zone.x, zone.z);
    },
    [focusOn, positioned]
  );

  const startGuidedTour = useCallback(() => {
    setIntroOpen(false);
    setTourActive(true);
    setTourIndex(0);
    focusZone(NEIGHBORHOODS[0], true);
  }, [focusZone]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);

  useEffect(() => {
    if (!tourActive) return;

    const interval = window.setInterval(() => {
      setTourIndex((current) => {
        const next = (current + 1) % NEIGHBORHOODS.length;
        focusZone(NEIGHBORHOODS[next], true);
        return next;
      });
    }, 3200);

    return () => window.clearInterval(interval);
  }, [focusZone, tourActive]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    setSceneStatus("starting");
    setSceneError(null);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#d8e9ef", 56, 112);

    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 140);
    camera.position.copy(AERIAL_HOME_CAMERA);
    camera.lookAt(AERIAL_HOME_TARGET);
    desiredCameraRef.current.copy(camera.position);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo inicializar WebGL en este navegador.";
      setSceneStatus("error");
      setSceneError(message);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor("#d8e9ef", 1);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    setSceneStatus("ready");

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 12;
    controls.maxDistance = 72;
    controls.minPolarAngle = Math.PI * 0.1;
    controls.maxPolarAngle = Math.PI * 0.32;
    controls.target.copy(AERIAL_HOME_TARGET);
    desiredTargetRef.current.copy(controls.target);

    const ambient = new THREE.HemisphereLight("#ffffff", "#b6c5aa", 2.6);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight("#fff4d6", 3.6);
    sun.position.set(-12, 28, 18);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(68, 46),
      new THREE.MeshStandardMaterial({ color: "#e2e5de", roughness: 0.88 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    addReferenceMapTexture(scene, renderer);
    addRiver(scene);
    addEcologicalReserve(scene);
    addPuertoMaderoDocks(scene);
    addPortAndRail(scene);
    addUrbanGrid(scene);
    addCoastline(scene);
    addParks(scene);
    NEIGHBORHOODS.forEach((district) => {
      addNeighborhoodTerrace(scene, district.x, district.z, district.radius, district.color);
      const label = createTextSprite(district.label, "#eadfce");
      label.position.set(district.x, 0.36, district.z + 1.85);
      scene.add(label);
    });

    addRoad(scene, [
      new THREE.Vector3(-23.5, 0.17, -14.8),
      new THREE.Vector3(-19.5, 0.17, -12.4),
      new THREE.Vector3(-14.8, 0.17, -8.6),
      new THREE.Vector3(-10.4, 0.17, -6.2),
      new THREE.Vector3(-6.2, 0.17, -3.7),
      new THREE.Vector3(-1.5, 0.17, -0.4),
      new THREE.Vector3(3.6, 0.17, 2.9),
      new THREE.Vector3(8.2, 0.17, 6.1),
      new THREE.Vector3(11.6, 0.17, 9.2),
    ]);
    addRoad(scene, [
      new THREE.Vector3(-22.4, 0.12, -11.6),
      new THREE.Vector3(-17.4, 0.12, -9.2),
      new THREE.Vector3(-13.4, 0.12, -4.8),
      new THREE.Vector3(-7.3, 0.12, -2.9),
      new THREE.Vector3(-2.5, 0.12, -0.9),
      new THREE.Vector3(3.2, 0.12, 2.1),
      new THREE.Vector3(9.6, 0.12, 6.6),
    ], "#bfa98b");
    addRoad(scene, [
      new THREE.Vector3(-22.4, 0.12, -16.3),
      new THREE.Vector3(-16.8, 0.12, -12.4),
      new THREE.Vector3(-11.6, 0.12, -9.2),
      new THREE.Vector3(-8.4, 0.12, -5.6),
      new THREE.Vector3(-3.8, 0.12, -2.2),
      new THREE.Vector3(1.2, 0.12, 1.4),
      new THREE.Vector3(5.6, 0.12, 6.8),
    ], "#e1d5c1");
    addBuildings(scene);

    const markerGroup = new THREE.Group();
    scene.add(markerGroup);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const markerMeshes: THREE.Mesh[] = [];

    positioned.forEach((dev) => {
      const color = statusColor(dev.status);
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.4, 1.8, 32),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.35,
          roughness: 0.35,
          metalness: 0.22,
        })
      );
      pin.position.set(dev.x, 1.0, dev.z);
      pin.userData.id = dev.id;
      markerGroup.add(pin);
      markerMeshes.push(pin);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.44, 32, 16),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.5,
          roughness: 0.3,
          metalness: 0.2,
        })
      );
      head.position.set(dev.x, 2.05, dev.z);
      head.userData.id = dev.id;
      markerGroup.add(head);
      markerMeshes.push(head);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.035, 8, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(dev.x, 0.12, dev.z);
      ring.userData.id = dev.id;
      markerGroup.add(ring);

      const label = createTextSprite(dev.name, "#fff7e8");
      label.position.set(dev.x, 2.9, dev.z);
      markerGroup.add(label);
    });

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(markerMeshes, false)[0];
      const nextHoveredId = hit?.object.userData.id || null;
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      if (hoveredIdRef.current !== nextHoveredId) {
        hoveredIdRef.current = nextHoveredId;
        setHoveredId(nextHoveredId);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(markerMeshes, false)[0];
      if (hit?.object.userData.id) {
        const nextActiveId = hit.object.userData.id;
        activeIdRef.current = nextActiveId;
        setActiveId(nextActiveId);
      }
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    let frame = 0;
    let raf = 0;
    const animate = () => {
      frame += 0.01;
      markerGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.geometry.type === "CylinderGeometry") {
          const isActive =
            child.userData.id === activeIdRef.current ||
            child.userData.id === hoveredIdRef.current;
          child.position.y = 1 + Math.sin(frame * 2.4 + child.position.x) * 0.06;
          child.scale.setScalar(isActive ? 1.18 : 1);
        }
      });
      camera.position.lerp(desiredCameraRef.current, 0.045);
      controls.target.lerp(desiredTargetRef.current, 0.045);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      controlsRef.current = null;
      cameraRef.current = null;
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [positioned]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#d8e9ef] text-bone">
      <div
        ref={mountRef}
        className="absolute left-0 top-0 h-screen min-h-full w-full"
        data-scene-status={sceneStatus}
        aria-label="Mapa 3D de Buenos Aires"
      />

      {sceneStatus !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#081013]">
          <div className="mx-6 max-w-md rounded-lg border border-bone/15 bg-[#0a0a0b]/72 p-5 text-center backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
              {sceneStatus === "error" ? "WebGL no disponible" : "Cargando mapa 3D"}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-bone/65">
              {sceneStatus === "error"
                ? `No pudimos iniciar la escena 3D. ${sceneError || ""}`
                : "Preparando la maqueta interactiva de Buenos Aires..."}
            </p>
          </div>
        </div>
      )}

      {introOpen && sceneStatus === "ready" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#081013]/38 px-5 backdrop-blur-[1px]">
          <div className="max-w-3xl text-center">
            <p className="mb-5 text-[10px] uppercase tracking-[0.32em] text-accent">
              Explore Buenos Aires
            </p>
            <h1 className="font-display text-5xl font-light leading-none tracking-tight text-bone md:text-7xl">
              Puerto Madero hasta Núñez.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-bone/68 md:text-base">
              Recorre el eje premium de la ciudad en una maqueta 3D, entra por zonas
              y abre cada desarrollo desde su ubicación.
            </p>
            <button
              onClick={() => {
                setIntroOpen(false);
                setTourActive(false);
                showFullCorridor();
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-accent/45 bg-accent px-7 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-ink transition hover:bg-bone"
            >
              Explorar mapa
              <Compass className="h-4 w-4" />
            </button>
            <button
              onClick={startGuidedTour}
              className="ml-0 mt-3 inline-flex items-center gap-2 rounded-full border border-bone/25 bg-bone/10 px-7 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-bone transition hover:border-accent/50 hover:text-accent md:ml-3 md:mt-8"
            >
              Recorrido guiado
              <Play className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,16,19,0.08)_0%,transparent_30%,rgba(8,16,19,0.16)_100%),linear-gradient(90deg,rgba(8,16,19,0.2)_0%,transparent_38%,rgba(8,16,19,0.08)_100%)]" />

      <div className="relative z-10 flex min-h-screen flex-col justify-between p-5 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl pt-20 md:pt-24">
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-accent">
              Mapa interactivo 3D
            </p>
            {introOpen ? (
              <>
                <h1 className="font-display text-4xl font-light leading-none tracking-tight md:text-6xl">
                  Corredor norte de Buenos Aires.
                </h1>
                <p className="mt-5 max-w-md text-sm leading-relaxed text-bone/65">
                  Desde Puerto Madero hasta Núñez, navega por zonas, selecciona proyectos
                  y abre la ficha de cada desarrollo.
                </p>
              </>
            ) : (
              <h1 className="font-display text-2xl font-light leading-none tracking-tight md:text-3xl">
                Puerto Madero → Núñez
              </h1>
            )}
          </div>

          <div className="mt-20 hidden flex-wrap items-center justify-end gap-2 md:flex">
            <div className="flex items-center gap-2 rounded-full border border-bone/15 bg-bone/10 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-bone/70 backdrop-blur-xl">
              <MousePointer2 className="h-3.5 w-3.5" />
              Arrastra, acerca y selecciona
            </div>
            <button
              onClick={() => {
                if (tourActive) {
                  setTourActive(false);
                } else {
                  startGuidedTour();
                }
              }}
              className="flex items-center gap-2 rounded-full border border-bone/15 bg-[#0a0a0b]/55 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-bone/70 backdrop-blur-xl transition hover:border-accent/50 hover:text-bone"
            >
              {tourActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {tourActive ? "Pausar tour" : "Tour guiado"}
            </button>
            <button
              onClick={() => {
                setTourActive(false);
                setIntroOpen(true);
              }}
              className="rounded-full border border-bone/15 bg-[#0a0a0b]/55 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-bone/70 backdrop-blur-xl transition hover:border-accent/50 hover:text-bone"
            >
              Intro
            </button>
          </div>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 md:hidden">
          <button
            onClick={() => {
              if (tourActive) {
                setTourActive(false);
              } else {
                startGuidedTour();
              }
            }}
            className="shrink-0 rounded-full border border-accent/35 bg-accent/15 px-3 py-2 text-[9px] uppercase tracking-[0.14em] text-accent backdrop-blur-xl transition hover:bg-accent hover:text-ink"
          >
            {tourActive ? "Pausar" : "Tour"}
          </button>
          {NEIGHBORHOODS.map((zone) => (
            <button
              key={zone.name}
              onClick={() => focusZone(zone)}
              className={`shrink-0 rounded-full border px-3 py-2 text-[9px] uppercase tracking-[0.14em] backdrop-blur-xl transition hover:border-accent/50 hover:text-bone ${
                tourActive && NEIGHBORHOODS[tourIndex]?.name === zone.name
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-bone/15 bg-[#0a0a0b]/60 text-bone/72"
              }`}
            >
              {zone.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-[240px_1fr_320px] md:items-end lg:grid-cols-[300px_1fr_380px]">
          <div className="hidden rounded-lg border border-bone/15 bg-[#0a0a0b]/58 p-4 backdrop-blur-xl md:block">
            <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-bone/45">
              <Route className="h-3.5 w-3.5" />
              Puerto Madero → Núñez
            </p>
            <div className="space-y-2">
              {NEIGHBORHOODS.map((zone) => (
                <button
                  key={zone.name}
                  onClick={() => focusZone(zone)}
                  className={`group flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition hover:border-accent/50 hover:text-bone ${
                    tourActive && NEIGHBORHOODS[tourIndex]?.name === zone.name
                      ? "border-accent/50 bg-accent/12 text-accent"
                      : "border-bone/10 bg-bone/[0.03] text-bone/70"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full transition group-hover:scale-125"
                      style={{ backgroundColor: zone.color }}
                    />
                    {zone.label}
                  </span>
                  <span className="text-bone/40">
                    {positioned.filter((dev) => dev.neighborhood === zone.name).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="hidden md:block" />

          {active ? (
            <aside className="rounded-lg border border-bone/15 bg-[#0a0a0b]/62 p-5 shadow-2xl backdrop-blur-2xl md:p-6">
              <>
                <div className="mb-4 flex items-center justify-between border-b border-bone/10 pb-4">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-bone/42">
                    Hotspot seleccionado
                  </p>
                  <button
                    onClick={startGuidedTour}
                    className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-accent transition hover:text-bone"
                  >
                    <Play className="h-3 w-3" />
                    Recorrer
                  </button>
                </div>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-accent">
                      <MapPin className="h-3.5 w-3.5" />
                      {active.neighborhood}
                    </p>
                    <h2 className="font-display text-3xl font-light leading-tight text-bone">
                      {active.name}
                    </h2>
                  </div>
                  <span className="rounded-full border border-accent/35 bg-accent/15 px-3 py-1 text-[9px] uppercase tracking-[0.16em] text-accent">
                    {DEVELOPMENT_STATUS_LABELS[active.status]}
                  </span>
                </div>

                <p className="mb-5 text-sm leading-relaxed text-bone/60">
                  {active.address || active.location}
                </p>

                <div className="mb-5 flex flex-wrap gap-2">
                  {positioned.slice(0, 6).map((dev) => (
                    <button
                      key={dev.id}
                      onClick={() => focusDevelopment(dev)}
                      className={`rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] transition ${
                        active.id === dev.id
                          ? "border-accent bg-accent/18 text-accent"
                          : "border-bone/10 bg-bone/[0.04] text-bone/52 hover:border-accent/40 hover:text-bone"
                      }`}
                    >
                      {dev.neighborhood}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-bone/10 bg-bone/[0.04] p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-bone/40">Desde</p>
                    <p className="mt-1 font-display text-xl text-accent">
                      {active.minPriceAvailable || active.priceFrom
                        ? formatPrice(active.minPriceAvailable || active.priceFrom || 0)
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-md border border-bone/10 bg-bone/[0.04] p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-bone/40">Avance</p>
                    <p className="mt-1 font-display text-xl text-bone">{active.progress}%</p>
                  </div>
                  <div className="rounded-md border border-bone/10 bg-bone/[0.04] p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-bone/40">Entrega</p>
                    <p className="mt-1 font-display text-lg text-bone">
                      {active.completionDate || "-"}
                    </p>
                  </div>
                  <div className="rounded-md border border-bone/10 bg-bone/[0.04] p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-bone/40">Unidades</p>
                    <p className="mt-1 font-display text-xl text-bone">
                      {active.availableUnits ?? "-"}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/desarrollos/${active.slug}`}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-ink transition hover:bg-bone"
                >
                  Ver proyecto
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </>
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}
