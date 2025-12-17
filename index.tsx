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
  Grid3X3,
  Moon,
  Sun,
  Tag
} from "lucide-react";

// --- Types ---
type PoseData = Record<string, {x: number, y: number, z: number}>;
type ThemeMode = 'light' | 'dark';
type Stroke = {
    points: {x: number, y: number}[];
    knee: {x: number, y: number};
    tip: {x: number, y: number};
};

// --- Constants ---
const LIMB_SEGMENT_1_LENGTH = 1.5;
const LIMB_SEGMENT_2_LENGTH = 2.0;
const SNAP_THRESHOLD = 0.5; // World units
const SNAP_ANGLE = Math.PI / 12; // 15 degrees

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

const App = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  const [theme, setTheme] = useState<ThemeMode>(() => {
      if (typeof window !== 'undefined') {
           const saved = localStorage.getItem('theme');
           if (saved === 'light' || saved === 'dark') return saved as ThemeMode;
           return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  
  // Use refs to track state in animation loop and event handlers to avoid stale closures
  const showLabelsRef = useRef(showLabels);
  const isCanvasModeRef = useRef(isCanvasMode);
  const isGeneratingRef = useRef(isGenerating);

  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { isCanvasModeRef.current = isCanvasMode; }, [isCanvasMode]);
  useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);
  
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [grabEnabled, setGrabEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(false);
  
  const [userPresets, setUserPresets] = useState<PoseData[]>([]);

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
  const dragTargetRef = useRef<THREE.Object3D | null>(null); 
  const dragPlaneRef = useRef(new THREE.Plane());
  
  const previousPointerRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);

  // Canvas State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<{x: number, y: number}[]>([]);
  const [strokeCount, setStrokeCount] = useState(0);

  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const limbMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const highlightMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const jointMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const invisibleMaterialRef = useRef<THREE.MeshBasicMaterial>(new THREE.MeshBasicMaterial({ 
      transparent: true, opacity: 0, depthWrite: false 
  }));

  const lightsRef = useRef<{ ambient: THREE.AmbientLight; directional: THREE.DirectionalLight; back: THREE.DirectionalLight; } | null>(null);

  const toggleTheme = () => {
      const next = theme === 'light' ? 'dark' : 'light';
      setTheme(next);
      localStorage.setItem('theme', next);
  };

  useEffect(() => {
    const isDark = theme === 'dark';
    
    // Update materials
    limbMaterialRef.current.color.setHex(isDark ? 0xF2F2F7 : 0x111111);
    jointMaterialRef.current.color.setHex(isDark ? 0x2c2c2e : 0x444444);
    
    // Initialize Highlight Material (Blue/Visible)
    highlightMaterialRef.current.color.setHex(0x007AFF);
    highlightMaterialRef.current.emissive.setHex(0x001A33);

    // Update Scene Background
    if (sceneRef.current) {
        const bg = isDark ? 0x000000 : 0xF2F2F7;
        sceneRef.current.background = new THREE.Color(bg);
        if (sceneRef.current.fog) {
            (sceneRef.current.fog as THREE.FogExp2).color.setHex(bg);
        }
    }
  }, [theme]);

  // --- 3D Initialization ---
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const bg = theme === 'dark' ? 0x000000 : 0xF2F2F7;
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.FogExp2(bg, 0.03); 
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
    
    // Initial color set based on current theme state
    const isDark = theme === 'dark';
    limbMaterialRef.current.color.setHex(isDark ? 0xF2F2F7 : 0x111111);
    jointMaterialRef.current.color.setHex(isDark ? 0x2c2c2e : 0x444444);

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
        
        // Reduced Hitbox Size (50% reduction)
        const seg1HitboxGeo = new THREE.BoxGeometry(0.12, seg1Length, 0.12);
        const seg1Hitbox = new THREE.Mesh(seg1HitboxGeo, invisibleMaterialRef.current);
        seg1Hitbox.position.y = seg1Length / 2;
        seg1Hitbox.userData = { isPart: true, isHitbox: true, type: 'joint', limbIndex: index, jointIndex: 1 };
        seg1Hitbox.name = "hitbox_j1";

        const seg1Wrapper = new THREE.Group();
        seg1Wrapper.userData = { isJoint: true, id: `limb_${index}_joint_1`, jointIndex: 1, limbIndex: index };
        seg1Wrapper.name = `limb_${index}_joint_1`;
        seg1Wrapper.add(seg1);
        seg1Wrapper.add(seg1Hitbox); 
        pivotGroup.add(seg1Wrapper);

        // Joint Mesh (Knee/Elbow) - Hidden but structural
        const joint = new THREE.Mesh(new THREE.SphereGeometry(thickness * 2.5, 12, 12), jointMaterialRef.current);
        joint.position.y = seg1Length / 2;
        joint.visible = false; 
        seg1.add(joint);
        
        // Knee Hitbox - Reduced
        const kneeHitbox = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), invisibleMaterialRef.current);
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

        // Tip Hitbox - Reduced
        const tipHitbox = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), invisibleMaterialRef.current);
        tipHitbox.position.y = seg2Length; // At the very end
        tipHitbox.userData = { isPart: true, isHitbox: true, type: 'tip', limbIndex: index };
        tipHitbox.name = "hitbox_tip";
        seg2.add(tipHitbox);

        // Standard segment hitbox - Reduced
        const seg2HitboxGeo = new THREE.ConeGeometry(0.15, seg2Length, 4);
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
  }, []);

  const updateLabels = (creatureGroup: THREE.Group) => {
    // Check refs to avoid stale closures in animation loop
    if (isCanvasModeRef.current) return;
    
    // First pass: collect potential labels
    const potentials: { id: number; x: number; y: number; z: number; el: HTMLDivElement }[] = [];
    
    INDIVIDUAL_LABELS.forEach((item, index) => {
        const labelDiv = labelRefs.current[index];
        if (!labelDiv) return;
        
        // Default to hidden
        labelDiv.style.opacity = '0';
        if (!showLabelsRef.current) return; // Check Ref for current state

        const jointName = `limb_${item.limbIndex}_joint_${item.jointIndex}`;
        let targetMesh: THREE.Object3D | null = null;
        creatureGroup.traverse(obj => {
            if (obj.name === jointName) {
                const visual = obj.children.find(c => c.name === "visual");
                if (visual) targetMesh = visual;
            }
        });

        if (targetMesh) {
            const tempV = new THREE.Vector3();
            (targetMesh as THREE.Mesh).getWorldPosition(tempV);
            const projV = tempV.clone().project(cameraRef.current!);
            
            // Frustum check
            if (Math.abs(projV.x) <= 0.95 && Math.abs(projV.y) <= 0.95) {
                const x = (projV.x * .5 + .5) * window.innerWidth;
                const y = (projV.y * -.5 + .5) * window.innerHeight;
                potentials.push({ id: index, x, y, z: projV.z, el: labelDiv });
            }
        }
    });
    
    // Second pass: Overlap detection
    const visible: typeof potentials = [];
    const MIN_DIST_SQ = 40 * 40; // 40px threshold

    // Simple greedy approach: render if not overlapping with already rendered
    for (const p of potentials) {
        let overlap = false;
        for (const v of visible) {
            const dx = p.x - v.x;
            const dy = p.y - v.y;
            if (dx*dx + dy*dy < MIN_DIST_SQ) {
                overlap = true;
                break;
            }
        }
        if (!overlap) {
            visible.push(p);
            p.el.style.opacity = '1';
            // Center the label (translate -50%) and place it
            p.el.style.transform = `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`;
        }
    }
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
         ...userPresets.map(p => () => p),
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
    const STEP = SNAP_ANGLE;
    creatureRef.current.traverse((obj) => {
        if (obj.userData.isJoint) {
            const { x, y, z } = obj.rotation;
            const snap = (val: number) => Math.round(val / STEP) * STEP;
            obj.rotation.set(snap(x), snap(y), snap(z));
        }
    });
  };

  useEffect(() => {
    if (snapEnabled) snapToGrid();
  }, [snapEnabled]);

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
          new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
          new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
          new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)
      ];
      let maxDot = -Infinity;
      let bestView = views[0];
      views.forEach(v => {
          const dot = direction.dot(v);
          if (dot > maxDot) { maxDot = dot; bestView = v; }
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
    
    const intersects = raycasterRef.current.intersectObjects(creatureRef.current!.children, true);
    const hit = intersects.find(i => i.object.userData.isHitbox);

    const currentTime = new Date().getTime();
    if (currentTime - lastTapRef.current < 300) {
         if (!hit) snapCameraToNearestView();
    }
    lastTapRef.current = currentTime;
    previousPointerRef.current = { x: e.clientX, y: e.clientY };

    if (hit && grabEnabled) {
        e.stopPropagation();
        if (controlsRef.current) controlsRef.current.enabled = false;
        isDraggingRef.current = true;
        
        const type = hit.object.userData.type; 
        const limbIndex = hit.object.userData.limbIndex;
        const joint1 = creatureRef.current!.getObjectByName(`limb_${limbIndex}_joint_1`);
        const joint2 = creatureRef.current!.getObjectByName(`limb_${limbIndex}_joint_2`);
        
        const hitPoint = hit.point.clone();
        const camDir = new THREE.Vector3();
        cameraRef.current!.getWorldDirection(camDir);
        dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, hitPoint);
        
        if (type === 'tip') {
             dragModeRef.current = 'ik_drag';
             dragTargetRef.current = joint1 as THREE.Object3D; 
             selectJoint((joint2 as any).children.find((c: any) => c.name==='visual') || joint2 as THREE.Mesh);
        } else if (type === 'knee') {
             dragModeRef.current = 'joint_rotate';
             dragTargetRef.current = joint1 as THREE.Object3D;
             selectJoint((joint1 as any).children.find((c: any) => c.name==='visual') || joint1 as THREE.Mesh);
        } else {
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
      const targetPoint = new THREE.Vector3();
      if (!ray.intersectPlane(dragPlaneRef.current, targetPoint)) return;

      if (dragModeRef.current === 'ik_drag') {
          const joint1 = dragTargetRef.current;
          const joint2 = joint1.getObjectByName(joint1.name.replace('joint_1', 'joint_2'))!;
          let snapPos = targetPoint.clone();
          let minDist = SNAP_THRESHOLD;
          let snapped = false;
          creatureRef.current!.traverse(obj => {
              if (obj.userData.isHitbox && obj.userData.type === 'tip') {
                  if (obj.userData.limbIndex === joint1.userData.limbIndex) return;
                  const otherTipWorld = new THREE.Vector3();
                  obj.getWorldPosition(otherTipWorld);
                  const d = otherTipWorld.distanceTo(targetPoint);
                  if (d < minDist) { minDist = d; snapPos.copy(otherTipWorld); snapped = true; }
              }
          });
          const finalTarget = snapped ? snapPos : targetPoint;
          const rootPos = new THREE.Vector3();
          joint1.getWorldPosition(rootPos);
          const direction = new THREE.Vector3().subVectors(finalTarget, rootPos);
          let dist = direction.length();
          
          // Revert to standard lengths for IK calculation to keep it stable, 
          // as variable limb length IK is complex if we don't track the variable length.
          const l1 = LIMB_SEGMENT_1_LENGTH; 
          const l2 = LIMB_SEGMENT_2_LENGTH;
          
          if (dist > l1 + l2 - 0.01) { dist = l1 + l2 - 0.01; direction.normalize().multiplyScalar(dist); }
          
          const cosKnee = (l1*l1 + l2*l2 - dist*dist) / (2*l1*l2);
          const kneeAngleInternal = Math.acos(Math.max(-1, Math.min(1, cosKnee)));
          const kneeBend = Math.PI - kneeAngleInternal; 
          joint2.rotation.set(0, 0, kneeBend); 

          const cosAlpha = (l1*l1 + dist*dist - l2*l2) / (2*l1*dist);
          const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
          const parent = joint1.parent!;
          const localTarget = finalTarget.clone();
          parent.worldToLocal(localTarget);
          const targetDir = localTarget.clone().normalize();
          const q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), targetDir);
          const qBend = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), -alpha); 
          joint1.quaternion.copy(q1.multiply(qBend));
          
      } else if (dragModeRef.current === 'joint_rotate') {
          const object = dragTargetRef.current;
          const parent = object.parent!;
          const localPoint = targetPoint.clone();
          parent.worldToLocal(localPoint);
          const dir = localPoint.normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
          
          if (snapEnabled) {
              const euler = new THREE.Euler().setFromQuaternion(q);
              const STEP = SNAP_ANGLE;
              euler.x = Math.round(euler.x / STEP) * STEP;
              euler.y = Math.round(euler.y / STEP) * STEP;
              euler.z = Math.round(euler.z / STEP) * STEP;
              object.quaternion.setFromEuler(euler);
          } else {
              object.quaternion.copy(q);
          }
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

  // --- Magic Pose 2.0 ---
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
          There are 8 limbs radiating from the Red center dot.
          For EACH limb (0 to 7), find the Blue dot (knee) and Green dot (tip).
          
          Return JSON:
          {
            "limbs": [
              { "id": 0, "knee": [x, y], "tip": [x, y] },
              ...
            ]
          }
          Normalize coordinates to 0-1 range.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ inlineData: { mimeType: "image/png", data: base64Data } }, { text: prompt }] },
            config: { responseMimeType: "application/json" }
        });

        const text = stripMarkdown(response.text || "{}");
        const result = JSON.parse(text);
        
        if (result.limbs && creatureRef.current) {
            const width = 20; 
            const height = width / (window.innerWidth/window.innerHeight);
            const aspect = window.innerWidth/window.innerHeight;
            const frustumHeight = 12;
            const frustumWidth = frustumHeight * aspect;

            result.limbs.forEach((l: any) => {
                const i = l.id;
                const j1 = creatureRef.current!.getObjectByName(`limb_${i}_joint_1`) as THREE.Group;
                const j2 = creatureRef.current!.getObjectByName(`limb_${i}_joint_2`) as THREE.Group;
                if (!j1 || !j2) return;

                // Calculate positions in "Frustum Space" (Z=0)
                const kneeX = (l.knee[0] - 0.5) * frustumWidth; 
                const kneeY = -(l.knee[1] - 0.5) * frustumHeight;
                const kneePos = new THREE.Vector3(kneeX, kneeY, 0); 
                
                const tipX = (l.tip[0] - 0.5) * frustumWidth;
                const tipY = -(l.tip[1] - 0.5) * frustumHeight;
                const tipPos = new THREE.Vector3(tipX, tipY, 0);

                // Calculate Limb Lengths based on sketch
                const origin = new THREE.Vector3(0,0,0); // J1 local origin (if projected to same plane)
                // Since the sketch corresponds to the camera view, and the root is at 0,0,0 in view:
                const d1 = origin.distanceTo(kneePos);
                const d2 = kneePos.distanceTo(tipPos);
                
                // Calculate scale ratios (clamped 0.85 - 1.15)
                const r1 = Math.min(1.15, Math.max(0.85, d1 / LIMB_SEGMENT_1_LENGTH));
                const r2 = Math.min(1.15, Math.max(0.85, d2 / LIMB_SEGMENT_2_LENGTH));
                
                // Apply Scale
                const seg1Mesh = j1.children.find(c => c.name === 'visual') as THREE.Mesh;
                const seg2Mesh = j2.children.find(c => c.name === 'visual') as THREE.Mesh;
                
                if (seg1Mesh) {
                    seg1Mesh.scale.set(1, r1, 1);
                    seg1Mesh.position.y = (LIMB_SEGMENT_1_LENGTH * r1) / 2;
                }
                
                // Move J2 to new knee position
                j2.position.y = LIMB_SEGMENT_1_LENGTH * r1;
                
                if (seg2Mesh) {
                    seg2Mesh.scale.set(1, r2, 1);
                    seg2Mesh.position.y = (LIMB_SEGMENT_2_LENGTH * r2) / 2;
                    // Move tip hitbox
                    const tipHitbox = seg2Mesh.children.find(c => c.name === 'hitbox_tip');
                    if (tipHitbox) tipHitbox.position.y = LIMB_SEGMENT_2_LENGTH; // Relative to scaled mesh, so position 2.0 * r2
                    // Wait, if mesh is scaled by r2, child position y=2.0 becomes 2.0*r2 in world. 
                    // So we keep local y constant.
                }

                // Apply Rotations (IK)
                // 1. Point J1 to Knee
                const localKnee = kneePos.clone();
                j1.parent!.worldToLocal(localKnee);
                const dir1 = localKnee.normalize();
                j1.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir1);
                
                // 2. Point J2 to Tip
                j1.updateWorldMatrix(true, false); // Update J1 to get correct world pos for J2
                const kneeWorldActual = new THREE.Vector3();
                j2.getWorldPosition(kneeWorldActual);
                
                const dir2Global = new THREE.Vector3().subVectors(tipPos, kneeWorldActual).normalize();
                const qWorld = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir2Global); 
                const parentQ = new THREE.Quaternion();
                j2.parent!.getWorldQuaternion(parentQ);
                j2.quaternion.copy(parentQ.invert().multiply(qWorld));
            });
            if (controlsRef.current) controlsRef.current.reset();
        }
        setIsCanvasMode(false);
        setStrokeCount(0);
        strokesRef.current = [];
      } catch (err) {
          console.error(err);
          setStrokeCount(0);
          strokesRef.current = [];
      } finally {
          setIsGenerating(false);
      }
  };

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
        redrawCanvas();
    }
  }, []);
  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  const redrawCanvas = () => {
     if (!canvasRef.current || !ctxRef.current) return;
     const ctx = ctxRef.current;
     const w = canvasRef.current.width;
     const h = canvasRef.current.height;
     const cx = w / 2;
     const cy = h / 2;

     ctx.clearRect(0, 0, w, h);

     // Draw Center Red Dot
     ctx.fillStyle = '#FF3B30';
     ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.fill();

     // Draw Saved Strokes
     ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = "black";
     
     strokesRef.current.forEach(stroke => {
         if (stroke.points.length < 2) return;
         ctx.beginPath();
         ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
         stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
         ctx.stroke();

         // Knee Dot
         ctx.fillStyle = '#007AFF';
         ctx.beginPath(); ctx.arc(stroke.knee.x, stroke.knee.y, 6, 0, Math.PI*2); ctx.fill();
         // Tip Dot
         ctx.fillStyle = '#34C759';
         ctx.beginPath(); ctx.arc(stroke.tip.x, stroke.tip.y, 6, 0, Math.PI*2); ctx.fill();
     });

     // Draw Current Stroke
     if (currentStrokeRef.current.length > 0) {
         ctx.beginPath();
         ctx.moveTo(currentStrokeRef.current[0].x, currentStrokeRef.current[0].y);
         currentStrokeRef.current.forEach(p => ctx.lineTo(p.x, p.y));
         ctx.stroke();
     }
  };

  useEffect(() => {
    if (isCanvasMode && canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctxRef.current = ctx;
          redrawCanvas();
        }
    }
  }, [isCanvasMode]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      if (isGeneratingRef.current) return; // Block drawing if generating
      if (!ctxRef.current || !canvasRef.current) return;
      const { x, y } = getCoords(e);
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      const cx = w / 2;
      const cy = h / 2;

      // Distance check to center
      const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
      
      // Allow start if within reasonable distance (e.g. 80px) or force snapping to center?
      // Prompt says "draw ... from this point". We'll force the start point to be center.
      isDrawingRef.current = true;
      currentStrokeRef.current = [{x: cx, y: cy}, {x, y}];
      redrawCanvas();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (isGeneratingRef.current) return; // Block drawing if generating
      if (!isDrawingRef.current || !ctxRef.current) return;
      const { x, y } = getCoords(e);
      currentStrokeRef.current.push({x, y});
      redrawCanvas();
  };

  const stopDrawing = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      
      const points = currentStrokeRef.current;
      if (points.length < 5) {
          currentStrokeRef.current = [];
          redrawCanvas();
          return;
      }

      const start = points[0];
      const tip = points[points.length - 1];

      // Estimate Knee (Point farthest from line start-tip)
      let maxDist = 0;
      let knee = points[Math.floor(points.length / 2)];
      
      // Line equation Ax + By + C = 0
      const A = start.y - tip.y;
      const B = tip.x - start.x;
      const C = start.x * tip.y - tip.x * start.y;
      const denom = Math.sqrt(A*A + B*B);

      if (denom > 1) { // Avoid divide by zero for super short lines
          points.forEach(p => {
              const d = Math.abs(A*p.x + B*p.y + C) / denom;
              if (d > maxDist) {
                  maxDist = d;
                  knee = p;
              }
          });
      }

      const newStroke: Stroke = { points: [...points], knee, tip };
      strokesRef.current.push(newStroke);
      currentStrokeRef.current = [];
      
      const newCount = strokesRef.current.length;
      setStrokeCount(newCount);
      redrawCanvas();

      if (newCount === 8) analyzeSketchAndApply();
  };

  const clearCanvas = () => {
      strokesRef.current = [];
      currentStrokeRef.current = [];
      setStrokeCount(0);
      redrawCanvas();
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
      
      // Save to user presets
      setUserPresets(prev => [...prev, poseData]);

      const json = JSON.stringify(poseData, null, 2);
      try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) { console.error(err); }
  };

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-black text-white' : 'bg-[#F2F2F7] text-black';
  
  // UI classes scaled down ~75%
  const iconBtnClass = (active: boolean) => `flex items-center justify-center w-7 h-7 rounded-full transition-all active:scale-95 ${active ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : (isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-white text-neutral-400')}`;
  const secondaryBtnClass = `flex items-center justify-center w-6 h-6 rounded-full transition-all active:scale-90 ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-black'}`;
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
          <div key={`${item.limbIndex}-${item.jointIndex}`} ref={el => { labelRefs.current[i] = el; }} className={`absolute top-0 left-0 text-2xl font-hand leading-none pointer-events-none transition-all duration-300 ${isDark ? 'text-white/80' : 'text-black/80'}`} style={{ opacity: 0 }}>
              {item.text}
          </div>
      ))}

      {isCanvasMode && (
          <div className={`absolute inset-0 z-50 cursor-crosshair touch-none ${bgClass}`}>
              <canvas ref={canvasRef} className="w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
              <div className="absolute top-safe right-4 mt-12 flex flex-col gap-4">
                  <button onClick={() => { setIsCanvasMode(false); setStrokeCount(0); strokesRef.current=[]; }} className={`${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/10 hover:bg-black/20 text-black'} p-2 rounded-full`}><X size={20} /></button>
                  <button onClick={clearCanvas} className={`${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/10 hover:bg-black/20 text-black'} p-2 rounded-full`}><Trash2 size={20} /></button>
              </div>
              <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center pointer-events-none">
                 {isGenerating && (<div className={`pointer-events-auto flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold shadow-none transition-all bg-transparent ${isDark ? 'text-white' : 'text-black'}`}><RefreshCcw className="animate-spin" size={20} /></div>)}
              </div>
          </div>
      )}

       {!isCanvasMode && (
       <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-3 z-40 pointer-events-none">
            <div className={`pointer-events-auto ${pillContainerClass}`}>
                  <button onClick={copyPose} className={secondaryBtnClass}>{copied ? <Check size={12} className="text-green-500"/> : <Copy size={12} />}</button>
                  <button onClick={generateRandomPose} className={secondaryBtnClass}><Shuffle size={12} /></button>
                  <button onClick={saveSnapshot} className={secondaryBtnClass}><Download size={12} /></button>
            </div>
            <div className="flex items-center gap-3 pointer-events-auto">
                 <button 
                     onClick={() => setOrbitEnabled(!orbitEnabled)} 
                     className={iconBtnClass(orbitEnabled)}
                 >
                    <Eye size={16} strokeWidth={2} />
                 </button>
                 <button 
                     onClick={() => setShowLabels(!showLabels)} 
                     className={iconBtnClass(showLabels)}
                 >
                    <Tag size={16} strokeWidth={2} />
                 </button>
                 <button onClick={() => setGrabEnabled(!grabEnabled)} className={iconBtnClass(grabEnabled)}><Hand size={16} strokeWidth={2} /></button>
                 <button onClick={toggleTheme} className={iconBtnClass(false)}>
                    {isDark ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />}
                 </button>
                 <button onClick={() => setSnapEnabled(!snapEnabled)} className={iconBtnClass(snapEnabled)}><Grid3X3 size={16} strokeWidth={2} /></button>
                 <div className="w-px h-5 bg-current opacity-20 mx-0.5"></div>
                 <button onClick={() => { setIsCanvasMode(true); setStrokeCount(0); strokesRef.current = []; }} className={iconBtnClass(false)}><Pencil size={16} strokeWidth={2} /></button>
            </div>
            <button onClick={resetPose} className={`pointer-events-auto flex items-center justify-center w-5 h-5 rounded-full opacity-50 hover:opacity-100 transition-opacity ${isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black'}`}><RefreshCcw size={10} /></button>
       </div>
       )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);