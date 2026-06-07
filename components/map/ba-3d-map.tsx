"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ArrowUpRight, Building2, Compass, MapPin, MousePointer2, Route } from "lucide-react";
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
  { name: "Retiro", label: "RETIRO", x: 7, z: 5.2, radius: 2.6, color: "#263832" },
  { name: "Recoleta", label: "RECOLETA", x: 3.5, z: 3, radius: 2.9, color: "#273b31" },
  { name: "Palermo", label: "PALERMO", x: -1.9, z: 0, radius: 4.4, color: "#2a4437" },
  { name: "Belgrano", label: "BELGRANO", x: -7.8, z: -3.8, radius: 3.6, color: "#243f36" },
  { name: "Nunez", label: "NUÑEZ", x: -12.6, z: -7.4, radius: 2.9, color: "#1f3934" },
];

const POSITION_HINTS: Record<string, { x: number; z: number; neighborhood: string }> = {
  madero: { x: 10.8, z: 8.4, neighborhood: "Puerto Madero" },
  retiro: { x: 7, z: 5.2, neighborhood: "Retiro" },
  catalinas: { x: 7.4, z: 5.6, neighborhood: "Retiro" },
  recoleta: { x: 3.5, z: 3, neighborhood: "Recoleta" },
  palermo: { x: -1.9, z: 0, neighborhood: "Palermo" },
  belgrano: { x: -7.8, z: -3.8, neighborhood: "Belgrano" },
  aguilar: { x: -7.2, z: -4.2, neighborhood: "Belgrano" },
  libertador: { x: -10.9, z: -6.5, neighborhood: "Nunez" },
  nunez: { x: -12.6, z: -7.4, neighborhood: "Nunez" },
  "nuñez": { x: -12.6, z: -7.4, neighborhood: "Nunez" },
};

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
  sprite.scale.set(5.8, 1.45, 1);
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
  const geometry = new THREE.TubeGeometry(curve, 48, 0.045, 8, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: "#3b2d21",
    emissiveIntensity: 0.16,
    roughness: 0.72,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  return mesh;
}

function addRiver(scene: THREE.Scene) {
  const shape = new THREE.Shape();
  shape.moveTo(0.5, -17);
  shape.bezierCurveTo(4.5, -11.5, 7.7, -5.5, 9.9, 1.4);
  shape.bezierCurveTo(11.8, 7.5, 13.8, 12.5, 19.2, 17);
  shape.lineTo(27, 17);
  shape.lineTo(27, -17);
  shape.lineTo(0.5, -17);

  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshStandardMaterial({
    color: "#2f7580",
    roughness: 0.38,
    metalness: 0.08,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  scene.add(mesh);
}

function addCoastline(scene: THREE.Scene) {
  addRoad(
    scene,
    [
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
    color: "#3f6042",
    roughness: 0.88,
    metalness: 0.02,
    transparent: true,
    opacity: 0.92,
  });

  [
    { x: -2.8, z: -1.4, sx: 5.6, sz: 2.4, rotation: -0.5 },
    { x: -9.8, z: -6, sx: 3.7, sz: 1.8, rotation: -0.55 },
    { x: 9.4, z: 8.9, sx: 2.3, sz: 1.4, rotation: -0.62 },
  ].forEach((park) => {
    const geometry = new THREE.CircleGeometry(1, 48);
    geometry.scale(park.sx, park.sz, 1);
    const mesh = new THREE.Mesh(geometry, parkMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = park.rotation;
    mesh.position.set(park.x, 0.055, park.z);
    scene.add(mesh);
  });
}

function addBuildings(scene: THREE.Scene) {
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: "#d9ccba",
    roughness: 0.78,
    metalness: 0.02,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: "#b89474",
    roughness: 0.62,
    metalness: 0.06,
  });

  for (let x = -16; x <= 12; x += 1.15) {
    for (let z = -11; z <= 11; z += 1.15) {
      const riverEdge = z > x * 0.74 + 1.8;
      const farWest = z < x * 0.62 - 5.1;
      const inPalermoPark = x > -5.3 && x < 1.2 && z > -3.2 && z < 1.8;
      const inNunezPark = x > -12.1 && x < -8.2 && z > -7.5 && z < -4.8;
      const skip =
        riverEdge ||
        farWest ||
        inPalermoPark ||
        inNunezPark ||
        Math.sin(x * 2.7 + z * 1.9) > 0.82;
      if (skip) continue;

      const height = 0.18 + Math.abs(Math.sin(x * 0.7) + Math.cos(z * 0.9)) * 0.55;
      const maderoBoost = x > 6 && z > 3.5 ? 2.2 : 1;
      const belgranoBoost = x < -6.5 && z < -2 ? 1.35 : 1;
      const palermoBoost = x > -3.5 && x < 1.8 ? 1.18 : 1;
      const boost = Math.max(maderoBoost, belgranoBoost, palermoBoost);
      const geometry = new THREE.BoxGeometry(0.36, height * boost, 0.42);
      const mesh = new THREE.Mesh(
        geometry,
        boost > 1.3 && Math.sin(x + z) > 0.1 ? accentMaterial : buildingMaterial
      );
      mesh.rotation.y = -0.55;
      mesh.position.set(x, (height * boost) / 2, z);
      scene.add(mesh);
    }
  }
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
  const [activeId, setActiveId] = useState<string | null>(developments[0]?.id || null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(true);
  const [sceneStatus, setSceneStatus] = useState<"idle" | "starting" | "ready" | "error">("idle");
  const [sceneError, setSceneError] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(developments[0]?.id || null);
  const hoveredIdRef = useRef<string | null>(null);

  const positioned = useMemo(
    () => developments.map((dev, index) => getPosition(dev, index)),
    [developments]
  );
  const active = positioned.find((dev) => dev.id === activeId) || positioned[0];

  const focusOn = useCallback((x: number, z: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    controls.target.set(x, 0.25, z);
    camera.position.set(x - 6.8, 9.2, z + 9.4);
    camera.lookAt(x, 0.25, z);
    controls.update();
  }, []);

  const focusDevelopment = useCallback(
    (dev: PositionedDevelopment) => {
      setIntroOpen(false);
      setActiveId(dev.id);
      focusOn(dev.x, dev.z);
    },
    [focusOn]
  );

  const focusZone = useCallback(
    (zone: (typeof NEIGHBORHOODS)[number]) => {
      setIntroOpen(false);
      const target = positioned.find((dev) => dev.neighborhood === zone.name);
      if (target) setActiveId(target.id);
      focusOn(zone.x, zone.z);
    },
    [focusOn, positioned]
  );

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    setSceneStatus("starting");
    setSceneError(null);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#081013", 24, 66);

    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(-15, 15, 18);
    camera.lookAt(-2, 0, 1);
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
    renderer.setClearColor("#081013", 1);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    setSceneStatus("ready");

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 34;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(-2, 0, 0.5);

    const ambient = new THREE.HemisphereLight("#d8f0ff", "#24170e", 2.2);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight("#ffe0b0", 3.1);
    sun.position.set(-10, 20, 12);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 34),
      new THREE.MeshStandardMaterial({ color: "#161e1b", roughness: 0.92 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    addRiver(scene);
    addCoastline(scene);
    addParks(scene);
    NEIGHBORHOODS.forEach((district) => {
      addNeighborhoodTerrace(scene, district.x, district.z, district.radius, district.color);
      const label = createTextSprite(district.label, "#eadfce");
      label.position.set(district.x, 0.36, district.z + 1.85);
      scene.add(label);
    });

    addRoad(scene, [
      new THREE.Vector3(-14.8, 0.17, -8.6),
      new THREE.Vector3(-10.4, 0.17, -6.2),
      new THREE.Vector3(-6.2, 0.17, -3.7),
      new THREE.Vector3(-1.5, 0.17, -0.4),
      new THREE.Vector3(3.6, 0.17, 2.9),
      new THREE.Vector3(8.2, 0.17, 6.1),
      new THREE.Vector3(11.6, 0.17, 9.2),
    ]);
    addRoad(scene, [
      new THREE.Vector3(-13.4, 0.12, -4.8),
      new THREE.Vector3(-7.3, 0.12, -2.9),
      new THREE.Vector3(-2.5, 0.12, -0.9),
      new THREE.Vector3(3.2, 0.12, 2.1),
      new THREE.Vector3(9.6, 0.12, 6.6),
    ], "#bfa98b");
    addRoad(scene, [
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
    <section className="relative min-h-screen overflow-hidden bg-[#081013] text-bone">
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
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#081013]/54 px-5 backdrop-blur-[2px]">
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
                focusOn(-1.9, 0);
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-accent/45 bg-accent px-7 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-ink transition hover:bg-bone"
            >
              Explorar mapa
              <Compass className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(184,148,116,0.2),transparent_30%),linear-gradient(90deg,rgba(8,16,19,0.78)_0%,rgba(8,16,19,0.24)_44%,rgba(8,16,19,0.5)_100%)]" />

      <div className="relative z-10 flex min-h-screen flex-col justify-between p-5 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl pt-20 md:pt-24">
            <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-accent">
              Mapa interactivo 3D
            </p>
            <h1 className="font-display text-4xl font-light leading-none tracking-tight md:text-6xl">
              Corredor norte de Buenos Aires.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-bone/65">
              Desde Puerto Madero hasta Núñez, navega por zonas, selecciona proyectos
              y abre la ficha de cada desarrollo.
            </p>
          </div>

          <div className="mt-20 hidden flex-wrap items-center justify-end gap-2 md:flex">
            <div className="flex items-center gap-2 rounded-full border border-bone/15 bg-bone/10 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-bone/70 backdrop-blur-xl">
              <MousePointer2 className="h-3.5 w-3.5" />
              Arrastra, acerca y selecciona
            </div>
            <button
              onClick={() => setIntroOpen(true)}
              className="rounded-full border border-bone/15 bg-[#0a0a0b]/55 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-bone/70 backdrop-blur-xl transition hover:border-accent/50 hover:text-bone"
            >
              Intro
            </button>
          </div>
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 lg:hidden">
          {NEIGHBORHOODS.map((zone) => (
            <button
              key={zone.name}
              onClick={() => focusZone(zone)}
              className="shrink-0 rounded-full border border-bone/15 bg-[#0a0a0b]/60 px-3 py-2 text-[9px] uppercase tracking-[0.14em] text-bone/72 backdrop-blur-xl transition hover:border-accent/50 hover:text-bone"
            >
              {zone.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_1fr_380px] lg:items-end">
          <div className="hidden rounded-lg border border-bone/15 bg-[#0a0a0b]/58 p-4 backdrop-blur-xl lg:block">
            <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-bone/45">
              <Route className="h-3.5 w-3.5" />
              Puerto Madero → Núñez
            </p>
            <div className="space-y-2">
              {NEIGHBORHOODS.map((zone) => (
                <button
                  key={zone.name}
                  onClick={() => focusZone(zone)}
                  className="group flex w-full items-center justify-between rounded-md border border-bone/10 bg-bone/[0.03] px-3 py-2 text-left text-xs text-bone/70 transition hover:border-accent/50 hover:text-bone"
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

          <div className="hidden lg:block" />

          <aside className="rounded-lg border border-bone/15 bg-[#0a0a0b]/74 p-5 shadow-2xl backdrop-blur-2xl md:p-6">
            {active ? (
              <>
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
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center text-center text-bone/60">
                <Building2 className="mb-3 h-8 w-8" />
                No hay desarrollos cargados para mostrar en el mapa.
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
