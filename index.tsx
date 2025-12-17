import React, { useRef, useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GoogleGenAI } from "@google/genai";
import { 
  Hand, 
  Eye, 
  Copy,
  Check,
  Shuffle,
  RefreshCcw,
  Download,
  Pencil,
  X,
  Trash2,
  Grid3X3
} from "lucide-react";

// --- Types ---
type PoseData = Record<string, {x: number, y: number, z: number}>;
type ThemeMode = 'light' | 'dark';

// --- Constants ---
const LIMB_SEGMENT_1_LENGTH = 1.5;
const LIMB_SEGMENT_2_LENGTH = 2.0;
const SNAP_THRESHOLD = 0.5; // World units

const INITIAL_POSE: PoseData = {
  "limb_0_joint_1": { "x": -0.102, "y": 0.062, "z": 1.451 },
  "limb_0_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_1_joint_1": { "x": -0.001, "y": -0.062, "z": 1.421 },
  "limb_1_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_2_joint_1": { "x": -0.109, "y": -0.05, "z": 1.444 },
  "limb_2_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_3_joint_1": { "x": 0.077, "y": 0.365, "z": 1.376 },
  "limb_3_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_4_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_4_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_5_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_5_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_6_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_6_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_7_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_7_joint_2": { "x": 0, "y": 0, "z": 1.57 }
};

const PRESET_POSE: PoseData = {
  "limb_0_joint_1": { "x": -0.102, "y": 0.062, "z": 1.451 },
  "limb_0_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_1_joint_1": { "x": 0.287, "y": 1.012, "z": 1.65 },
  "limb_1_joint_2": { "x": -0.53, "y": -0.623, "z": 1.227 },
  "limb_2_joint_1": { "x": -0.109, "y": -0.05, "z": 1.444 },
  "limb_2_joint_2": { "x": -0.104, "y": -0.141, "z": 1.587 },
  "limb_3_joint_1": { "x": 0.065, "y": 1.066, "z": 2.036 },
  "limb_3_joint_2": { "x": -0.897, "y": -0.518, "z": 0.936 },
  "limb_4_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_4_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_5_joint_1": { "x": 0.611, "y": 0.557, "z": 0.647 },
  "limb_5_joint_2": { "x": -1.813, "y": -0.873, "z": -0.359 },
  "limb_6_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_6_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_7_joint_1": { "x": -0.582, "y": 1.014, "z": 1.42 },
  "limb_7_joint_2": { "x": -0.499, "y": 0.572, "z": -1.179 }
};

const PRESET_POSE_2: PoseData = {
  "limb_0_joint_1": { "x": -0.1, "y": 0.051, "z": 1.493 },
  "limb_0_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_1_joint_1": { "x": 0.287, "y": 1.012, "z": 1.65 },
  "limb_1_joint_2": { "x": 1.288, "y": -0.117, "z": -0.375 },
  "limb_2_joint_1": { "x": -0.109, "y": -0.05, "z": 1.444 },
  "limb_2_joint_2": { "x": -0.104, "y": -0.141, "z": 1.587 },
  "limb_3_joint_1": { "x": 0.065, "y": 1.066, "z": 2.036 },
  "limb_3_joint_2": { "x": 1.141, "y": -0.213, "z": -0.792 },
  "limb_4_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_4_joint_2": { "x": 0.113, "y": -0.027, "z": -1.195 },
  "limb_5_joint_1": { "x": 0.611, "y": 0.557, "z": 0.647 },
  "limb_5_joint_2": { "x": -1.813, "y": -0.873, "z": -0.359 },
  "limb_6_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_6_joint_2": { "x": 0, "y": 0, "z": 1.57 },
  "limb_7_joint_1": { "x": -0.582, "y": 1.014, "z": 1.42 },
  "limb_7_joint_2": { "x": 0.775, "y": 0.628, "z": 0.961 }
};

const generateLabels = () => {
    const labels = [];
    const representativeLimbs = [0, 3, 4, 7]; 
    representativeLimbs.forEach(i => {
        if (i < 4) { 
            labels.push({ text: "define", limbIndex: i, jointIndex: 1 });
            labels.push({ text: "discover", limbIndex: i, jointIndex: 2 });
        } else { 
            labels.push({ text: "develop", limbIndex: i, jointIndex: 1 });
            labels.push({ text: "deploy", limbIndex: i, jointIndex: 2 });
        }
    });
    return labels;
};
const INDIVIDUAL_LABELS = generateLabels();

const COLORS = {
  light: {
    bg: 0xf2f2f7,
    fog: 0xf2f2f7,
    limb: 0x000000, 
    joint: 0x000000,
    edge: 0xaeaeb2,
    ambient: 0xffffff,
    directional: 0xffffff,
    back: 0x8e8e93
  },
  dark: {
    bg: 0x000000,
    fog: 0x000000,
    limb: 0xf2f2f7,
    joint: 0x2c2c2e,
    edge: 0x636366,
    ambient: 0x404040,
    directional: 0xffffff,
    back: 0x0a84ff
  }
};

const CACHE_KEY = "mento_pose_cache";

const createWobblyGeometry = (baseGeo: THREE.BufferGeometry, magnitude: number = 0.015) => {
  const geo = baseGeo.clone();
  const posAttribute = geo.attributes.position;
  const count = posAttribute.count;
  for (let i = 0; i < count; i++) {
    const dx = (Math.random() - 0.5) * magnitude;
    const dy = (Math.random() - 0.5) * magnitude;
    const dz = (Math.random() - 0.5) * magnitude;
    posAttribute.setX(i, posAttribute.getX(i) + dx);
    posAttribute.setY(i, posAttribute.getY(i) + dy);
    posAttribute.setZ(i, posAttribute.getZ(i) + dz);
  }
  geo.computeVertexNormals();
  return geo;
};

const stripMarkdown = (text: string) => {
    let clean = text.trim();
    if (clean.startsWith("```json")) clean = clean.substring(7);
    if (clean.startsWith("```")) clean = clean.substring(3);
    if (clean.endsWith("```")) clean = clean.substring(0, clean.length - 3);
    return clean.trim();
};

const useSystemTheme = (): ThemeMode => {
  const getTheme = () => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const [theme, setTheme] = useState<ThemeMode>(getTheme);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  return theme;
};

const App = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const theme = useSystemTheme();
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [strokeCount, setStrokeCount] = useState(0);
  
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [grabEnabled, setGrabEnabled] = useState(true);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const creatureRef = useRef<THREE.Group | null>(null);
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  
  // Interaction State
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<'joint_rotate' | 'ik_drag' | null>(null);
  const dragTargetRef = useRef<THREE.Object3D | null>(null); // The object being dragged (Joint1 or Tip)
  const dragPlaneRef = useRef(new THREE.Plane());
  
  const previousPointerRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const limbMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const highlightMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const jointMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const invisibleMaterialRef = useRef<THREE.MeshBasicMaterial>(new THREE.MeshBasicMaterial({ 
      transparent: true, opacity: 0, depthWrite: false 
  }));

  const lightsRef = useRef<{ ambient: THREE.AmbientLight; directional: THREE.DirectionalLight; back: THREE.DirectionalLight; } | null>(null);

  // --- 3D Initialization ---
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.03); 
    sceneRef.current = scene;

    const frustumSize = 12;
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 0.1, 1000
    );
    camera.position.set(0, 0, 20);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 20);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 1);
    backLight.position.set(-5, -5, -20);
    scene.add(backLight);
    lightsRef.current = { ambient: ambientLight, directional: dirLight, back: backLight };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enabled = true;
    controlsRef.current = controls;

    const creatureGroup = new THREE.Group();
    creatureRef.current = creatureGroup;
    scene.add(creatureGroup);

    limbMaterialRef.current.roughness = 0.5;
    limbMaterialRef.current.metalness = 0.5;
    highlightMaterialRef.current.roughness = 0.5;
    highlightMaterialRef.current.metalness = 0.5;
    jointMaterialRef.current.roughness = 0.1;
    jointMaterialRef.current.metalness = 0.9;

    const angles = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
    
    const createLimb = (isUpper: boolean, angle: number, index: number) => {
        const pivotGroup = new THREE.Group();
        pivotGroup.rotation.y = angle;
        const verticalAngle = isUpper ? Math.PI / 4 : -Math.PI / 4;
        pivotGroup.rotation.z = verticalAngle;
        creatureGroup.add(pivotGroup);

        // Segment 1
        const seg1Length = LIMB_SEGMENT_1_LENGTH;
        const thickness = 0.05; 
        const seg1BaseGeo = new THREE.BoxGeometry(thickness, seg1Length, thickness, 3, 12, 3);
        const seg1Geo = createWobblyGeometry(seg1BaseGeo, 0.02);
        const seg1 = new THREE.Mesh(seg1Geo, limbMaterialRef.current);
        seg1.position.y = seg1Length / 2;
        seg1.name = "visual";
        
        const seg1HitboxGeo = new THREE.BoxGeometry(0.3, seg1Length, 0.3);
        const seg1Hitbox = new THREE.Mesh(seg1HitboxGeo, invisibleMaterialRef.current);
        seg1Hitbox.position.y = seg1Length / 2;
        // Mark as hitbox for Joint 1 (The base)
        seg1Hitbox.userData = { isPart: true, isHitbox: true, type: 'joint', limbIndex: index, jointIndex: 1 };
        seg1Hitbox.name = "hitbox_j1";

        const seg1Wrapper = new THREE.Group();
        seg1Wrapper.userData = { isJoint: true, id: `limb_${index}_joint_1`, jointIndex: 1, limbIndex: index };
        seg1Wrapper.name = `limb_${index}_joint_1`;
        seg1Wrapper.add(seg1);
        seg1Wrapper.add(seg1Hitbox); 
        pivotGroup.add(seg1Wrapper);

        // Joint Mesh (Knee/Elbow) - VISUAL HIDDEN but physically there for structure
        const joint = new THREE.Mesh(new THREE.SphereGeometry(thickness * 2.5, 12, 12), jointMaterialRef.current);
        joint.position.y = seg1Length / 2;
        joint.visible = false; // Hide visual joint as requested
        seg1.add(joint);
        
        // Add a hitbox specifically for grabbing the Knee/Elbow to point the limb
        // Increased size to 0.9 for easier grabbing
        const kneeHitbox = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), invisibleMaterialRef.current);
        kneeHitbox.position.y = seg1Length / 2;
        kneeHitbox.userData = { isPart: true, isHitbox: true, type: 'knee', limbIndex: index };
        seg1.add(kneeHitbox);

        // Segment 2
        const seg2Length = LIMB_SEGMENT_2_LENGTH;
        const seg2BaseGeo = new THREE.ConeGeometry(thickness * 0.6, seg2Length, 6, 12);
        const seg2Geo = createWobblyGeometry(seg2BaseGeo, 0.02);
        const seg2 = new THREE.Mesh(seg2Geo, limbMaterialRef.current);
        seg2.position.y = seg2Length / 2;
        seg2.name = "visual";

        // Tip Hitbox
        // Increased size to 1.2 for significantly easier grabbing of tips
        const tipHitbox = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), invisibleMaterialRef.current);
        tipHitbox.position.y = seg2Length; // At the very end
        tipHitbox.userData = { isPart: true, isHitbox: true, type: 'tip', limbIndex: index };
        tipHitbox.name = "hitbox_tip";
        seg2.add(tipHitbox);

        // Standard segment hitbox
        const seg2HitboxGeo = new THREE.ConeGeometry(0.3, seg2Length, 4);
        const seg2Hitbox = new THREE.Mesh(seg2HitboxGeo, invisibleMaterialRef.current);
        seg2Hitbox.position.y = seg2Length / 2;
        seg2Hitbox.userData = { isPart: true, isHitbox: true, type: 'segment', limbIndex: index, jointIndex: 2 };
        seg2Hitbox.name = "hitbox_j2";

        const seg2Wrapper = new THREE.Group();
        seg2Wrapper.userData = { isJoint: true, id: `limb_${index}_joint_2`, jointIndex: 2, limbIndex: index };
        seg2Wrapper.name = `limb_${index}_joint_2`;
        seg2Wrapper.position.y = seg1Length; 

        seg2Wrapper.add(seg2);
        seg2Wrapper.add(seg2Hitbox);
        seg1Wrapper.add(seg2Wrapper);
    };

    angles.forEach((angle, i) => createLimb(true, angle, i));
    angles.forEach((angle, i) => createLimb(false, angle, i + 4));

    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) applyPoseToRef(JSON.parse(cached), creatureGroup);
        else applyPoseToRef(INITIAL_POSE, creatureGroup);
    } catch (e) { applyPoseToRef(INITIAL_POSE, creatureGroup); }

    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        updateLabels(creatureGroup);
      }
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [showLabels]); 

  const updateLabels = (creatureGroup: THREE.Group) => {
    if (isCanvasMode) return;
    const tempV = new THREE.Vector3();
    
    INDIVIDUAL_LABELS.forEach((item, index) => {
        const labelDiv = labelRefs.current[index];
        if (!labelDiv) return;
        if (!showLabels) { labelDiv.style.opacity = '0'; return; }

        const jointName = `limb_${item.limbIndex}_joint_${item.jointIndex}`;
        let targetMesh: THREE.Object3D | null = null;
        creatureGroup.traverse(obj => {
            if (obj.name === jointName) {
                const visual = obj.children.find(c => c.name === "visual");
                if (visual) targetMesh = visual;
            }
        });

        if (targetMesh) {
            (targetMesh as THREE.Mesh).getWorldPosition(tempV);
            const projV = tempV.clone().project(cameraRef.current!);
            const x = (projV.x * .5 + .5) * window.innerWidth + 30;
            const y = (projV.y * -.5 + .5) * window.innerHeight;

            if (Math.abs(projV.x) > 1.1 || Math.abs(projV.y) > 1.1) {
                    labelDiv.style.opacity = '0';
            } else {
                labelDiv.style.opacity = '1';
                labelDiv.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            }
        }
    });
  };

  const applyPoseToRef = (pose: PoseData, group: THREE.Group) => {
      group.traverse((obj) => {
          if (obj.userData.isJoint && obj.userData.id && pose[obj.userData.id]) {
             const { x, y, z } = pose[obj.userData.id];
             obj.rotation.set(x, y, z);
          }
      });
  };

  const generateRandomPose = () => {
     const strategies = [
         () => PRESET_POSE, 
         () => PRESET_POSE_2,
         () => {
             const j1 = { x: (Math.random()-0.5)*3, y: (Math.random()-0.5)*2, z: (Math.random()-0.5)*2 };
             const j2 = { x: (Math.random()-0.5)*3, y: (Math.random()-0.5)*2, z: (Math.random()-0.5)*2 };
             const pose: PoseData = {};
             for(let i=0; i<4; i++) { pose[`limb_${i}_joint_1`] = j1; pose[`limb_${i}_joint_2`] = j2; }
             for(let i=4; i<8; i++) { pose[`limb_${i}_joint_1`] = { x: -j1.x, y: j1.y, z: j1.z }; pose[`limb_${i}_joint_2`] = { x: -j2.x, y: j2.y, z: j2.z }; }
             return pose;
         }
     ];
     const strategy = strategies[Math.floor(Math.random() * strategies.length)];
     if (creatureRef.current) applyPoseToRef(strategy(), creatureRef.current);
  };

  const snapToGrid = () => {
    if (!creatureRef.current) return;
    const STEP = Math.PI / 12; // 15 degrees
    creatureRef.current.traverse((obj) => {
        if (obj.userData.isJoint) {
            const { x, y, z } = obj.rotation;
            const snap = (val: number) => Math.round(val / STEP) * STEP;
            obj.rotation.set(snap(x), snap(y), snap(z));
        }
    });
  };

  const saveSnapshot = () => {
      if (rendererRef.current) {
          const img = rendererRef.current.domElement.toDataURL("image/png");
          const link = document.createElement("a");
          link.download = `mento-pose-${Date.now()}.png`;
          link.href = img;
          link.click();
      }
  }

  const snapCameraToNearestView = () => {
      if (!cameraRef.current || !controlsRef.current) return;
      
      const controls = controlsRef.current;
      const camera = cameraRef.current;

      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      const distance = offset.length();
      const direction = offset.normalize();

      const views = [
          new THREE.Vector3(0, 0, 1),  // Front
          new THREE.Vector3(0, 0, -1), // Back
          new THREE.Vector3(1, 0, 0),  // Right
          new THREE.Vector3(-1, 0, 0), // Left
          new THREE.Vector3(0, 1, 0),  // Top
          new THREE.Vector3(0, -1, 0)  // Bottom
      ];

      let maxDot = -Infinity;
      let bestView = views[0];

      views.forEach(v => {
          const dot = direction.dot(v);
          if (dot > maxDot) {
              maxDot = dot;
              bestView = v;
          }
      });

      const newPos = bestView.clone().multiplyScalar(distance).add(controls.target);
      camera.position.copy(newPos);
      camera.lookAt(controls.target);
      controls.update();
  };

  // --- Interaction Logic ---
  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = rendererRef.current!.domElement.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current!);
    
    // Check hitboxes
    const intersects = raycasterRef.current.intersectObjects(creatureRef.current!.children, true);
    const hit = intersects.find(i => i.object.userData.isHitbox);

    const currentTime = new Date().getTime();
    if (currentTime - lastTapRef.current < 300) {
         if (!hit) {
             snapCameraToNearestView();
         }
    }
    lastTapRef.current = currentTime;

    previousPointerRef.current = { x: e.clientX, y: e.clientY };

    if (hit && grabEnabled) {
        e.stopPropagation();
        if (controlsRef.current) controlsRef.current.enabled = false;
        isDraggingRef.current = true;
        
        const type = hit.object.userData.type; // 'tip', 'knee', 'joint', 'segment'
        const limbIndex = hit.object.userData.limbIndex;
        
        // Find the main joint wrappers
        const joint1 = creatureRef.current!.getObjectByName(`limb_${limbIndex}_joint_1`);
        const joint2 = creatureRef.current!.getObjectByName(`limb_${limbIndex}_joint_2`);
        
        // Determine drag plane (plane passing through hit point facing camera)
        const hitPoint = hit.point.clone();
        const camDir = new THREE.Vector3();
        cameraRef.current!.getWorldDirection(camDir);
        dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, hitPoint);
        
        if (type === 'tip') {
             // Dragging tip -> IK Mode
             dragModeRef.current = 'ik_drag';
             // Store reference to the whole limb structure needed for IK
             dragTargetRef.current = joint1 as THREE.Object3D; 
             selectJoint((joint2 as any).children.find((c: any) => c.name==='visual') || joint2 as THREE.Mesh);
        } else if (type === 'knee') {
             // Dragging knee -> LookAt Mode (Rotate Joint 1 to look at cursor)
             dragModeRef.current = 'joint_rotate';
             dragTargetRef.current = joint1 as THREE.Object3D;
             selectJoint((joint1 as any).children.find((c: any) => c.name==='visual') || joint1 as THREE.Mesh);
        } else {
             // Default rotating behavior (existing lever drag)
             dragModeRef.current = 'joint_rotate';
             const wrapper = hit.object.parent!.userData.isJoint ? hit.object.parent : hit.object.parent!.parent;
             dragTargetRef.current = wrapper as THREE.Object3D;
             selectJoint(hit.object as THREE.Mesh);
        }
    } else {
        if (selectedMeshRef.current) {
            selectedMeshRef.current.material = limbMaterialRef.current;
            selectedMeshRef.current = null;
            setSelectedId(null);
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !dragTargetRef.current) return;
      
      const rect = rendererRef.current!.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(new THREE.Vector2(nx, ny), cameraRef.current!);
      const ray = raycasterRef.current.ray;
      
      // Calculate intersection with the drag plane
      const targetPoint = new THREE.Vector3();
      if (!ray.intersectPlane(dragPlaneRef.current, targetPoint)) return;

      if (dragModeRef.current === 'ik_drag') {
          // --- IK SOLVER with Snapping ---
          const joint1 = dragTargetRef.current;
          const joint2 = joint1.getObjectByName(joint1.name.replace('joint_1', 'joint_2'))!;
          
          // 1. Auto Snap
          let snapPos = targetPoint.clone();
          let minDist = SNAP_THRESHOLD;
          let snapped = false;

          creatureRef.current!.traverse(obj => {
              if (obj.userData.isHitbox && obj.userData.type === 'tip') {
                  // Don't snap to self
                  if (obj.userData.limbIndex === joint1.userData.limbIndex) return;
                  
                  const otherTipWorld = new THREE.Vector3();
                  obj.getWorldPosition(otherTipWorld);
                  const d = otherTipWorld.distanceTo(targetPoint);
                  if (d < minDist) {
                      minDist = d;
                      snapPos.copy(otherTipWorld);
                      snapped = true;
                  }
              }
          });

          const finalTarget = snapped ? snapPos : targetPoint;

          // 2. Solve 2-Bone IK
          // Root position (Joint 1 world pos)
          const rootPos = new THREE.Vector3();
          joint1.getWorldPosition(rootPos);
          
          // Vector from Root to Target
          const direction = new THREE.Vector3().subVectors(finalTarget, rootPos);
          let dist = direction.length();
          
          // Clamp distance to total limb length
          const l1 = LIMB_SEGMENT_1_LENGTH;
          const l2 = LIMB_SEGMENT_2_LENGTH;
          if (dist > l1 + l2 - 0.01) {
              dist = l1 + l2 - 0.01;
              direction.normalize().multiplyScalar(dist);
          }
          
          // Point Joint 1 towards target
          // Simple LookAt doesn't work well due to hierarchy, use Quaternion
          const up = new THREE.Vector3(0, 1, 0); // Limbs are built along Y
          
          // We want the 'end' of the chain to touch 'finalTarget'.
          // First, rotate Joint 1 so the entire limb plane aligns with target
          // This is a simplification: We align Joint 1 Y-axis generally towards target
          // But we also need to account for the bend.
          
          // Analytic solution for interior angles
          // Cosine Rule: c^2 = a^2 + b^2 - 2ab cos(C)
          // dist^2 = l1^2 + l2^2 - 2*l1*l2*cos(angle_at_knee_internal)
          // cos(knee) = (l1^2 + l2^2 - dist^2) / (2*l1*l2)
          const cosKnee = (l1*l1 + l2*l2 - dist*dist) / (2*l1*l2);
          const kneeAngleInternal = Math.acos(Math.max(-1, Math.min(1, cosKnee)));
          const kneeBend = Math.PI - kneeAngleInternal; // Bend from straight (0)
          
          // Rotation for Joint 2 (Knee)
          // It rotates around Z axis in local space
          // Note: joint2 is child of joint1.
          joint2.rotation.set(kneeBend, 0, 0); // Assuming bend is on X axis for this model setup? 
          // Wait, model was: pivot rotation Y, then rotation Z. 
          // Let's check model structure. createLimb uses Z for vertical angle.
          // Let's try setting rotation.z for knee bend? Or rotation.x?
          // Based on createLimb: segment grows in Y. Pivot rotates Z.
          // So Joint 2 should rotate around Z or X to bend. 
          // Let's assume Z for "hinge".
          joint2.rotation.set(0, 0, kneeBend); 

          // Rotation for Joint 1
          // Needs to point towards target, corrected for the bend.
          // The limb effectively forms a triangle. The angle offset at Joint 1 is:
          // l2^2 = l1^2 + dist^2 - 2*l1*dist*cos(alpha)
          const cosAlpha = (l1*l1 + dist*dist - l2*l2) / (2*l1*dist);
          const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
          
          // Now, align Joint 1 to point to target, then back off by alpha.
          // Converting global direction to local parent space is hard.
          // Easiest approach: LookAt logic using helper matrices.
          
          const parent = joint1.parent!;
          const localTarget = finalTarget.clone();
          parent.worldToLocal(localTarget);
          
          // Construct orientation
          // Point Joint 1 Y-axis to localTarget
          const targetDir = localTarget.clone().normalize();
          const q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), targetDir);
          
          // Add the alpha offset. We need to rotate 'back' by alpha in the plane of the bend.
          // For simplicity in this "Wobbly" app, let's just point straight and bend knee.
          // It's a stick figure, exact analytic plane retention isn't critical.
          // To make it look natural, just Point Joint 1 at target, then rotate by -alpha on the bend axis.
          const qBend = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), -alpha); 
          joint1.quaternion.copy(q1.multiply(qBend));
          
      } else if (dragModeRef.current === 'joint_rotate') {
          // --- Simple Look At / Lever Drag ---
          // Rotate the dragged joint (Joint 1 or Joint 2) to look at cursor
          const object = dragTargetRef.current;
          const parent = object.parent!;
          const localPoint = targetPoint.clone();
          parent.worldToLocal(localPoint);
          
          // Just align Y axis (limb axis) to the point
          const dir = localPoint.normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
          object.quaternion.copy(q);
      }
  };

  const handlePointerUp = () => {
      isDraggingRef.current = false;
      dragTargetRef.current = null;
      dragModeRef.current = null;
      if (controlsRef.current) controlsRef.current.enabled = orbitEnabled;
  };
  
  useEffect(() => { if (controlsRef.current) controlsRef.current.enabled = orbitEnabled; }, [orbitEnabled]);

  const selectJoint = (mesh: THREE.Mesh) => {
      let visualMesh = mesh;
      if (mesh.userData.isHitbox) {
         const found = mesh.parent?.children.find(c => c.name === "visual") as THREE.Mesh;
         if (found) visualMesh = found;
      }
      if (selectedMeshRef.current) selectedMeshRef.current.material = limbMaterialRef.current;
      selectedMeshRef.current = visualMesh;
      selectedMeshRef.current.material = highlightMaterialRef.current;
      if (visualMesh.parent?.userData.isJoint) setSelectedId(visualMesh.parent.userData.id);
  };

  // --- Magic Pose 2.0 (2D -> 3D Reconstruction) ---
  const analyzeSketchAndApply = async () => {
      if (!canvasRef.current) return;
      setIsGenerating(true);
      try {
        if (!process.env.API_KEY) throw new Error("API Key missing");
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const dataUrl = canvasRef.current.toDataURL("image/png");
        const base64Data = dataUrl.split(",")[1];
        
        const prompt = `
          Analyze this 2D stick figure sketch.
          There are 8 limbs. For EACH limb (0 to 7), identify the 2D coordinates of the "knee" (mid-joint) and the "tip" (end).
          Normalize coordinates to 0-1 range (0,0 is top-left).
          
          Return JSON:
          {
            "limbs": [
              { "id": 0, "knee": [x, y], "tip": [x, y] },
              ...
            ]
          }
          Limb 0-3: Arms/Upper. Limb 4-7: Legs/Lower.
          Important: Simply trace the visual lines.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ inlineData: { mimeType: "image/png", data: base64Data } }, { text: prompt }] },
            config: { responseMimeType: "application/json" }
        });

        const text = stripMarkdown(response.text || "{}");
        const result = JSON.parse(text);
        
        if (result.limbs && creatureRef.current) {
            // Reconstruct 3D from 2D points
            const width = 20; // Approx world width at z=0 for ortho camera
            const height = width / (window.innerWidth/window.innerHeight);
            const aspect = window.innerWidth/window.innerHeight;
            
            // We need to map 0..1 to world coordinates
            // Camera is at 0,0,20. Looking at 0,0,0.
            // Ortho scale depends on frustum size (12).
            const frustumHeight = 12;
            const frustumWidth = frustumHeight * aspect;

            result.limbs.forEach((l: any) => {
                const i = l.id;
                const j1 = creatureRef.current!.getObjectByName(`limb_${i}_joint_1`);
                const j2 = creatureRef.current!.getObjectByName(`limb_${i}_joint_2`);
                if (!j1 || !j2) return;

                // 1. Get Root World Pos (Start of limb)
                const rootPos = new THREE.Vector3();
                j1.getWorldPosition(rootPos);
                
                // 2. Convert 2D Knee to 3D Target on plane Z=rootPos.z
                // Map 0..1 to -Width/2 .. Width/2
                const kneeX = (l.knee[0] - 0.5) * frustumWidth; 
                const kneeY = -(l.knee[1] - 0.5) * frustumHeight;
                const kneePos = new THREE.Vector3(kneeX, kneeY, 0); // Assume flat depth for sketching
                
                // 3. Convert 2D Tip
                const tipX = (l.tip[0] - 0.5) * frustumWidth;
                const tipY = -(l.tip[1] - 0.5) * frustumHeight;
                const tipPos = new THREE.Vector3(tipX, tipY, 0);

                // 4. Orient Joint 1 to point to Knee
                // Convert kneePos to j1 parent local space
                const localKnee = kneePos.clone();
                j1.parent!.worldToLocal(localKnee);
                const dir1 = localKnee.normalize();
                j1.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir1);

                // 5. Orient Joint 2 to point to Tip
                // Update j2 world matrix after j1 rotation
                j1.updateWorldMatrix(true, false);
                // Get Knee World Pos (which is j1 position + offset? No, j2 is at end of j1 segment)
                const kneeWorldActual = new THREE.Vector3();
                j2.getWorldPosition(kneeWorldActual);
                
                // Vector from Actual Knee to Target Tip
                const dir2Global = new THREE.Vector3().subVectors(tipPos, kneeWorldActual).normalize();
                
                // Convert to j2 parent local space (which is j1 space)
                // Actually j2 is child of j1's wrapper chain.
                // We can just calculate rotation in world space and apply inverse parent
                const qWorld = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir2Global); // Assuming j2 default up is Y
                const parentQ = new THREE.Quaternion();
                j2.parent!.getWorldQuaternion(parentQ);
                j2.quaternion.copy(parentQ.invert().multiply(qWorld));
            });
            
            if (controlsRef.current) controlsRef.current.reset();
        }
        setIsCanvasMode(false);
        setStrokeCount(0);
      } catch (err) {
          console.error(err);
          setStrokeCount(0);
      } finally {
          setIsGenerating(false);
      }
  };

  // --- Canvas Logic ---
  const handleResize = useCallback(() => {
    if (cameraRef.current && rendererRef.current) {
      const frustumSize = 12;
      const aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.left = -frustumSize * aspect / 2;
      cameraRef.current.right = frustumSize * aspect / 2;
      cameraRef.current.top = frustumSize / 2;
      cameraRef.current.bottom = -frustumSize / 2;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    }
    if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
    }
  }, []);
  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  useEffect(() => {
    if (isCanvasMode && canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = "black";
          ctxRef.current = ctx;
        }
    }
  }, [isCanvasMode]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      isDrawingRef.current = true;
      const { x, y } = getCoords(e);
      ctxRef.current?.beginPath(); ctxRef.current?.moveTo(x, y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawingRef.current || !ctxRef.current) return;
      const { x, y } = getCoords(e);
      ctxRef.current.lineTo(x, y); ctxRef.current.stroke();
  };
  const stopDrawing = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false; ctxRef.current?.closePath();
      const newCount = strokeCount + 1;
      setStrokeCount(newCount);
      if (newCount === 8) analyzeSketchAndApply();
  };
  const clearCanvas = () => {
      if (canvasRef.current && ctxRef.current) {
          ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          setStrokeCount(0);
      }
  };
  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
      if ("touches" in e) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: e.clientX, y: e.clientY };
  };
  const resetPose = () => { if (creatureRef.current) applyPoseToRef(INITIAL_POSE, creatureRef.current); };
  const copyPose = async () => {
      if (!creatureRef.current) return;
      const poseData: PoseData = {};
      creatureRef.current.traverse((obj) => {
          if (obj.userData.isJoint && obj.userData.id) {
              poseData[obj.userData.id] = { x: Number(obj.rotation.x.toFixed(3)), y: Number(obj.rotation.y.toFixed(3)), z: Number(obj.rotation.z.toFixed(3)) };
          }
      });
      const json = JSON.stringify(poseData, null, 2);
      try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) { console.error(err); }
  };

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-black text-white' : 'bg-[#F2F2F7] text-black';
  
  // Scaled down UI to approx 75%
  // w-12 -> w-9 (3rem -> 2.25rem)
  // w-10 -> w-8 (2.5rem -> 2rem)
  const iconBtnClass = (active: boolean) => `flex items-center justify-center w-9 h-9 rounded-full transition-all active:scale-95 ${active ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : (isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-white text-neutral-400')}`;
  const secondaryBtnClass = `flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-90 ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-black'}`;
  const pillContainerClass = `flex items-center gap-1 p-1 rounded-full border backdrop-blur-md ${isDark ? 'bg-neutral-900/80 border-white/5' : 'bg-white/80 border-black/5'}`;

  return (
    <div className={`relative w-full h-full overflow-hidden select-none transition-colors duration-500 ${bgClass}`}>
      <div 
        className="absolute inset-0 z-0 touch-none"
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      
      {!isCanvasMode && INDIVIDUAL_LABELS.map((item, i) => (
          <div key={`${item.limbIndex}-${item.jointIndex}`} ref={el => labelRefs.current[i] = el} className={`absolute top-0 left-0 text-2xl font-hand leading-none pointer-events-none transition-all duration-300 ${isDark ? 'text-white/80' : 'text-black/80'}`} style={{ opacity: 0 }}>
              {item.text}
          </div>
      ))}

      {isCanvasMode && (
          <div className="absolute inset-0 z-50 bg-white cursor-crosshair touch-none">
              <canvas ref={canvasRef} className="w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
              <div className="absolute top-safe right-4 mt-12 flex flex-col gap-4">
                  <button onClick={() => { setIsCanvasMode(false); setStrokeCount(0); }} className="bg-black/10 hover:bg-black/20 p-3 rounded-full text-black"><X size={24} /></button>
                  <button onClick={clearCanvas} className="bg-black/10 hover:bg-black/20 p-3 rounded-full text-black"><Trash2 size={24} /></button>
              </div>
              <div className="absolute top-12 left-0 right-0 flex justify-center pointer-events-none">
                   <div className="bg-black/10 text-black px-4 py-2 rounded-full font-hand text-2xl font-bold">{isGenerating ? "..." : `${strokeCount} / 8`}</div>
              </div>
              <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center pointer-events-none">
                 {isGenerating && (<div className={`pointer-events-auto flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold shadow-none transition-all bg-gray-400 text-white`}><RefreshCcw className="animate-spin" size={20} /></div>)}
              </div>
          </div>
      )}

       {!isCanvasMode && (
       <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-4 z-40 pointer-events-none">
            <div className={`pointer-events-auto ${pillContainerClass}`}>
                  <button onClick={copyPose} className={secondaryBtnClass}>{copied ? <Check size={14} className="text-green-500"/> : <Copy size={14} />}</button>
                  <button onClick={generateRandomPose} className={secondaryBtnClass}><Shuffle size={14} /></button>
                  <button onClick={saveSnapshot} className={secondaryBtnClass}><Download size={14} /></button>
            </div>
            <div className="flex items-center gap-4 pointer-events-auto">
                 <button 
                     onClick={() => setOrbitEnabled(!orbitEnabled)} 
                     onDoubleClick={(e) => { e.stopPropagation(); setShowLabels(prev => !prev); }}
                     className={iconBtnClass(orbitEnabled)}
                 >
                    <Eye size={18} strokeWidth={2} />
                 </button>
                 <button onClick={() => setGrabEnabled(!grabEnabled)} className={iconBtnClass(grabEnabled)}><Hand size={18} strokeWidth={2} /></button>
                 <button onClick={snapToGrid} className={iconBtnClass(false)}><Grid3X3 size={18} strokeWidth={2} /></button>
                 <div className="w-px h-6 bg-current opacity-20 mx-1"></div>
                 <button onClick={() => { setIsCanvasMode(true); setStrokeCount(0); }} className={iconBtnClass(false)}><Pencil size={18} strokeWidth={2} /></button>
            </div>
            <button onClick={resetPose} className={`pointer-events-auto flex items-center justify-center w-6 h-6 rounded-full opacity-50 hover:opacity-100 transition-opacity ${isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black'}`}><RefreshCcw size={12} /></button>
       </div>
       )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);