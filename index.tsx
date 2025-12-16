import React, { useRef, useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { 
  Hand, 
  Eye, 
  RotateCw,
  RotateCcw,
  Copy,
  Check,
  Shuffle,
  Grid3x3
} from "lucide-react";

// --- Types ---
type PoseData = Record<string, {x: number, y: number, z: number}>;
type ThemeMode = 'light' | 'dark';

// --- Constants ---
const INITIAL_POSE: PoseData = {
  "limb_0_joint_1": { "x": 0.624, "y": 0.246, "z": 0.98 },
  "limb_0_joint_2": { "x": -2.976, "y": -0.537, "z": 1.043 },
  "limb_1_joint_1": { "x": 0.092, "y": 0.593, "z": -2.637 },
  "limb_1_joint_2": { "x": 0, "y": 0, "z": -2.094 },
  "limb_2_joint_1": { "x": 0.648, "y": 0.194, "z": 0.598 },
  "limb_2_joint_2": { "x": -1.714, "y": -0.542, "z": 1.568 },
  "limb_3_joint_1": { "x": -1.424, "y": 0.01, "z": -1.274 },
  "limb_3_joint_2": { "x": -1.379, "y": -0.446, "z": -3.134 },
  "limb_4_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_4_joint_2": { "x": 0.251, "y": 0.378, "z": 1.425 },
  "limb_5_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_5_joint_2": { "x": -0.3, "y": 0.13, "z": 1.522 },
  "limb_6_joint_1": { "x": 0, "y": 0, "z": 0 },
  "limb_6_joint_2": { "x": 0.796, "y": 0.142, "z": 1.507 },
  "limb_7_joint_1": { "x": 2.923, "y": -0.704, "z": -2.115 },
  "limb_7_joint_2": { "x": 0, "y": 0, "z": 2.094 }
};

const COLORS = {
  light: {
    bg: 0xf2f2f7, // iOS System Gray 6
    fog: 0xf2f2f7,
    limb: 0x1c1c1e, // iOS System Gray 6 Dark
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

// Generate Presets
const generatePreset = (type: string): PoseData => {
  const pose: PoseData = {};
  const limbCount = 8;
  for (let i = 0; i < limbCount; i++) {
    const isUpper = i < 4;
    const setJ = (j: 1 | 2, x: number, y: number, z: number) => {
      pose[`limb_${i}_joint_${j}`] = { x, y, z };
    };

    if (type === 'default') return INITIAL_POSE;
    
    if (type === 'standing') {
       setJ(1, 0, 0, isUpper ? 2.5 : 0.2); 
       setJ(2, 0, 0, 0);
    } else if (type === 'sprawled') {
       setJ(1, 0, 1.5, 0);
       setJ(2, 0, 0, 0);
    } else if (type === 'curled') {
       setJ(1, 1.5, 0, 2.0);
       setJ(2, -2.5, 0, 0);
    } else if (type === 't-pose') {
       setJ(1, 0, 1.57, 0);
       setJ(2, 0, 0, 0);
    } else if (type === 'walking') {
       const odd = i % 2 === 0;
       setJ(1, odd ? 0.5 : -0.5, 0, 0.5);
       setJ(2, odd ? 1.0 : 0.0, 0, 0);
    } else if (type === 'chaos') {
       setJ(1, Math.random()*2, Math.random()*2, Math.random()*2);
       setJ(2, Math.random()*2, Math.random()*2, Math.random()*2);
    } else if (type === 'alert') {
       setJ(1, -0.5, 0, -0.5);
       setJ(2, -0.5, 0, 0);
    } else if (type === 'box') {
       setJ(1, 0, 0, 1.57);
       setJ(2, 0, 0, 1.57);
    } else if (type === 'twisted') {
        setJ(1, 0, 2, i * 0.5);
        setJ(2, 0, 0, 0);
    } else {
       setJ(1, 0, 0, 0);
       setJ(2, 0, 0, 0);
    }
  }
  return pose;
};

const PRESETS = [
  INITIAL_POSE,
  generatePreset('standing'),
  generatePreset('sprawled'),
  generatePreset('curled'),
  generatePreset('t-pose'),
  generatePreset('walking'),
  generatePreset('chaos'),
  generatePreset('alert'),
  generatePreset('box'),
  generatePreset('twisted'),
];

// --- Hook: System Theme ---
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
  
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [poseEnabled, setPoseEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const creatureRef = useRef<THREE.Group | null>(null);
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const isDraggingRef = useRef(false);
  const previousPointerRef = useRef({ x: 0, y: 0 });

  // Material Refs for dynamic updates
  const limbMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const highlightMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const jointMaterialRef = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial());
  const edgeMaterialRef = useRef<THREE.LineBasicMaterial>(new THREE.LineBasicMaterial());
  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    directional: THREE.DirectionalLight;
    back: THREE.DirectionalLight;
  } | null>(null);

  // --- 3D Initialization ---
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.03); 
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 8);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 1);
    backLight.position.set(-5, -5, -5);
    scene.add(backLight);

    lightsRef.current = { ambient: ambientLight, directional: dirLight, back: backLight };

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enabled = true;
    controlsRef.current = controls;

    // --- Build Creature ---
    const creatureGroup = new THREE.Group();
    creatureRef.current = creatureGroup;
    scene.add(creatureGroup);

    // Initialize Material Properties
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

        const seg1Length = 1.5;
        const seg1Geo = new THREE.BoxGeometry(0.1, seg1Length, 0.1);
        const seg1 = new THREE.Mesh(seg1Geo, limbMaterialRef.current);
        seg1.position.y = seg1Length / 2;
        seg1.userData = { isPart: true, partType: 'limb', limbIndex: index, segmentIndex: 1 };
        
        const seg1Wrapper = new THREE.Group();
        seg1Wrapper.userData = { isJoint: true, id: `limb_${index}_joint_1` };
        
        const pose1 = INITIAL_POSE[`limb_${index}_joint_1`];
        if (pose1) seg1Wrapper.rotation.set(pose1.x, pose1.y, pose1.z);

        seg1Wrapper.add(seg1);
        pivotGroup.add(seg1Wrapper);
        
        const e1 = new THREE.EdgesGeometry(seg1Geo);
        const l1 = new THREE.LineSegments(e1, edgeMaterialRef.current);
        seg1.add(l1);

        const joint = new THREE.Mesh(new THREE.SphereGeometry(0.0625, 16, 16), jointMaterialRef.current);
        joint.position.y = seg1Length / 2;
        seg1.add(joint);

        const seg2Length = 2.0;
        const seg2Geo = new THREE.ConeGeometry(0.05, seg2Length, 4);
        const seg2 = new THREE.Mesh(seg2Geo, limbMaterialRef.current);
        seg2.position.y = seg2Length / 2;
        seg2.userData = { isPart: true, partType: 'limb', limbIndex: index, segmentIndex: 2 };

        const seg2Wrapper = new THREE.Group();
        seg2Wrapper.userData = { isJoint: true, id: `limb_${index}_joint_2` };
        seg2Wrapper.position.y = seg1Length; 
        
        const pose2 = INITIAL_POSE[`limb_${index}_joint_2`];
        if (pose2) {
             seg2Wrapper.rotation.set(pose2.x, pose2.y, pose2.z);
        } else {
             seg2Wrapper.rotation.z = isUpper ? -Math.PI / 1.5 : Math.PI / 1.5;
        }

        seg1Wrapper.add(seg2Wrapper);
        seg2Wrapper.add(seg2);

        const e2 = new THREE.EdgesGeometry(seg2Geo);
        const l2 = new THREE.LineSegments(e2, edgeMaterialRef.current);
        seg2.add(l2);
    };

    angles.forEach((angle, i) => createLimb(true, angle, i));
    angles.forEach((angle, i) => createLimb(false, angle, i + 4));

    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // --- Dynamic Theme Update ---
  useEffect(() => {
    const palette = COLORS[theme];
    
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(palette.bg);
      if (sceneRef.current.fog) {
        (sceneRef.current.fog as THREE.FogExp2).color.setHex(palette.fog);
      }
    }

    limbMaterialRef.current.color.setHex(palette.limb);
    highlightMaterialRef.current.color.setHex(palette.limb);
    highlightMaterialRef.current.emissive.setHex(theme === 'dark' ? 0xff3b30 : 0xff453a); // iOS Red
    
    jointMaterialRef.current.color.setHex(palette.joint);
    edgeMaterialRef.current.color.setHex(palette.edge);

    if (lightsRef.current) {
      lightsRef.current.ambient.color.setHex(palette.ambient);
      lightsRef.current.directional.color.setHex(palette.directional);
      lightsRef.current.back.color.setHex(palette.back);
    }
  }, [theme]);

  const handleResize = useCallback(() => {
    if (cameraRef.current && rendererRef.current) {
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  // --- Interaction Logic ---
  useEffect(() => {
    if (controlsRef.current && !isDraggingRef.current) {
        controlsRef.current.enabled = orbitEnabled;
    }
  }, [orbitEnabled]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = rendererRef.current!.domElement.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current!);
    
    const intersects = raycasterRef.current.intersectObjects(creatureRef.current!.children, true);
    const hit = intersects.find(i => i.object.userData.isPart);
    
    if (hit && poseEnabled) {
        isDraggingRef.current = true;
        if (controlsRef.current) controlsRef.current.enabled = false;
        
        previousPointerRef.current = { x: e.clientX, y: e.clientY };
        
        if (selectedMeshRef.current) {
            selectedMeshRef.current.material = limbMaterialRef.current;
        }
        
        selectedMeshRef.current = hit.object as THREE.Mesh;
        selectedMeshRef.current.material = highlightMaterialRef.current;
        
        const wrapper = selectedMeshRef.current.parent;
        if (wrapper && wrapper.userData.isJoint) {
           setSelectedId(wrapper.userData.id);
        }
        
        e.stopPropagation(); 
    } else {
        if (selectedMeshRef.current) {
            selectedMeshRef.current.material = limbMaterialRef.current;
            selectedMeshRef.current = null;
            setSelectedId(null);
        }

        if (controlsRef.current) {
            controlsRef.current.enabled = orbitEnabled;
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !selectedMeshRef.current || !poseEnabled) return;
      
      const deltaX = e.clientX - previousPointerRef.current.x;
      const deltaY = e.clientY - previousPointerRef.current.y;
      previousPointerRef.current = { x: e.clientX, y: e.clientY };

      const wrapper = selectedMeshRef.current.parent;
      if (wrapper && wrapper.userData.isJoint) {
          const sensitivity = 0.005;
          const camera = cameraRef.current;
          if (!camera) return;

          const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
          
          const rotX = new THREE.Quaternion().setFromAxisAngle(camRight, deltaY * sensitivity);
          const rotY = new THREE.Quaternion().setFromAxisAngle(camUp, deltaX * sensitivity);
          
          const deltaQ = rotY.multiply(rotX);
          
          const currentWorldQ = new THREE.Quaternion();
          wrapper.getWorldQuaternion(currentWorldQ);
          
          const newWorldQ = deltaQ.multiply(currentWorldQ);
          
          const parent = wrapper.parent;
          const parentWorldQ = new THREE.Quaternion();
          if (parent) {
             parent.getWorldQuaternion(parentWorldQ);
          }
          
          const newLocalQ = parentWorldQ.invert().multiply(newWorldQ);
          
          wrapper.quaternion.copy(newLocalQ);

          if (snapEnabled) {
              const euler = new THREE.Euler().setFromQuaternion(newLocalQ);
              const snapStep = THREE.MathUtils.degToRad(15); 
              
              euler.x = Math.round(euler.x / snapStep) * snapStep;
              euler.y = Math.round(euler.y / snapStep) * snapStep;
              euler.z = Math.round(euler.z / snapStep) * snapStep;
              
              wrapper.rotation.copy(euler);
          }
      }
  };

  const handlePointerUp = () => {
      isDraggingRef.current = false;
      if (controlsRef.current) {
          controlsRef.current.enabled = orbitEnabled;
      }
  };

  const resetPose = () => {
     applyPose(INITIAL_POSE);
  };

  const randomizePose = () => {
      const randomPreset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
      applyPose(randomPreset);
  };

  const applyPose = (pose: PoseData) => {
      if(!creatureRef.current) return;
      creatureRef.current.traverse((obj) => {
          if (obj.userData.isJoint && obj.userData.id && pose[obj.userData.id]) {
             const { x, y, z } = pose[obj.userData.id];
             obj.rotation.set(x, y, z);
          }
      });
  };

  const copyPose = async () => {
      if (!creatureRef.current) return;
      const poseData: PoseData = {};
      creatureRef.current.traverse((obj) => {
          if (obj.userData.isJoint && obj.userData.id) {
              poseData[obj.userData.id] = {
                  x: Number(obj.rotation.x.toFixed(3)),
                  y: Number(obj.rotation.y.toFixed(3)),
                  z: Number(obj.rotation.z.toFixed(3))
              };
          }
      });
      const json = JSON.stringify(poseData, null, 2);
      try {
          await navigator.clipboard.writeText(json);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      } catch (err) {
          console.error("Failed to copy pose", err);
      }
  };

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-black text-white' : 'bg-[#F2F2F7] text-black';
  const actionBtnClass = isDark 
    ? 'text-neutral-400 hover:text-white hover:bg-white/10'
    : 'text-neutral-500 hover:text-black hover:bg-black/5';

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

       {/* Top Info Bar */}
       <div className={`absolute top-0 left-0 right-0 p-4 pt-[max(1rem,env(safe-area-inset-top))] flex justify-between items-start pointer-events-none z-40`}>
          <div className={`text-xs font-mono opacity-50`}>Mento 3D</div>
          {selectedId && (
            <div className={`px-2 py-1 rounded text-xs font-bold tracking-widest uppercase backdrop-blur-sm shadow-sm ${
               isDark ? 'bg-white/10 text-white' : 'bg-white/50 text-black'
            }`}>
               {selectedId.replace(/_/g, ' ')}
            </div>
          )}
       </div>

       {/* Bottom Toolbar - Standard Fixed Layout */}
       <div className={`absolute bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] z-50 pointer-events-auto transition-colors duration-300 border-t backdrop-blur-md ${
           isDark ? 'bg-neutral-900/80 border-white/10' : 'bg-white/80 border-black/10'
       }`}>
           <div className="flex justify-between items-center px-6 py-3">
                {/* Left Group: Modes */}
                <div className="flex gap-4">
                    <button onClick={() => { setOrbitEnabled(true); setPoseEnabled(false); }} 
                      className={`p-2 transition-colors ${orbitEnabled ? (isDark ? 'text-white' : 'text-black') : 'text-neutral-400'}`}>
                      <Eye size={24} strokeWidth={1.5} />
                    </button>
                    <button onClick={() => { setOrbitEnabled(false); setPoseEnabled(true); }}
                      className={`p-2 transition-colors ${poseEnabled ? (isDark ? 'text-white' : 'text-black') : 'text-neutral-400'}`}>
                      <Hand size={24} strokeWidth={1.5} />
                    </button>
                </div>

                {/* Right Group: Actions */}
                <div className="flex gap-4">
                    <button onClick={copyPose} className={`p-2 active:opacity-50 ${actionBtnClass}`}>
                        {copied ? <Check size={24} className="text-green-500" /> : <Copy size={24} strokeWidth={1.5} />}
                    </button>
                    <button onClick={randomizePose} className={`p-2 active:opacity-50 ${actionBtnClass}`}>
                        <Shuffle size={24} strokeWidth={1.5} />
                    </button>
                    <button onClick={resetPose} className={`p-2 active:opacity-50 ${actionBtnClass}`}>
                        <RotateCcw size={24} strokeWidth={1.5} />
                    </button>
                    <button onClick={() => setSnapEnabled(!snapEnabled)} 
                       className={`p-2 transition-colors ${snapEnabled ? (isDark ? 'text-white' : 'text-black') : 'text-neutral-400'}`}>
                       <Grid3x3 size={24} strokeWidth={1.5} />
                    </button>
                </div>
           </div>
       </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);