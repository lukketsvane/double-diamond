import React, { useRef, useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { 
  Hand, 
  Eye, 
  Copy,
  Check,
  Shuffle,
  RefreshCcw,
  Grid3x3,
  Download
} from "lucide-react";

// --- Types ---
type PoseData = Record<string, {x: number, y: number, z: number}>;
type ThemeMode = 'light' | 'dark';
type AppMode = 'orbit' | 'grab' | 'free';

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
    bg: 0xf2f2f7,
    fog: 0xf2f2f7,
    limb: 0x1c1c1e,
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
  
  // State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<AppMode>('free');

  // Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const creatureRef = useRef<THREE.Group | null>(null);
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  
  // Interaction Refs
  const isDraggingRef = useRef(false);
  const dragPlaneRef = useRef(new THREE.Plane());
  const dragStartPointRef = useRef(new THREE.Vector3());
  const dragStartVectorRef = useRef(new THREE.Vector3());
  const jointWorldPosRef = useRef(new THREE.Vector3());
  const previousPointerRef = useRef({ x: 0, y: 0 });

  // Material Refs
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
    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: false,
        preserveDrawingBuffer: true // Required for screenshot
    });
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
        // Thinner geometry
        const seg1Geo = new THREE.BoxGeometry(0.04, seg1Length, 0.04);
        const seg1 = new THREE.Mesh(seg1Geo, limbMaterialRef.current);
        seg1.position.y = seg1Length / 2;
        seg1.userData = { isPart: true, partType: 'limb', limbIndex: index, segmentIndex: 1 };
        
        const seg1Wrapper = new THREE.Group();
        seg1Wrapper.userData = { isJoint: true, id: `limb_${index}_joint_1` };
        
        seg1Wrapper.add(seg1);
        pivotGroup.add(seg1Wrapper);
        
        const e1 = new THREE.EdgesGeometry(seg1Geo);
        const l1 = new THREE.LineSegments(e1, edgeMaterialRef.current);
        seg1.add(l1);

        const joint = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 16), jointMaterialRef.current);
        joint.position.y = seg1Length / 2;
        seg1.add(joint);

        const seg2Length = 2.0;
        const seg2Geo = new THREE.ConeGeometry(0.02, seg2Length, 4);
        const seg2 = new THREE.Mesh(seg2Geo, limbMaterialRef.current);
        seg2.position.y = seg2Length / 2;
        seg2.userData = { isPart: true, partType: 'limb', limbIndex: index, segmentIndex: 2 };

        const seg2Wrapper = new THREE.Group();
        seg2Wrapper.userData = { isJoint: true, id: `limb_${index}_joint_2` };
        seg2Wrapper.position.y = seg1Length; 

        seg1Wrapper.add(seg2Wrapper);
        seg2Wrapper.add(seg2);

        const e2 = new THREE.EdgesGeometry(seg2Geo);
        const l2 = new THREE.LineSegments(e2, edgeMaterialRef.current);
        seg2.add(l2);
    };

    angles.forEach((angle, i) => createLimb(true, angle, i));
    angles.forEach((angle, i) => createLimb(false, angle, i + 4));

    // Load Pose
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            applyPoseToRef(JSON.parse(cached), creatureGroup);
        } else {
            applyPoseToRef(INITIAL_POSE, creatureGroup);
        }
    } catch (e) {
        applyPoseToRef(INITIAL_POSE, creatureGroup);
    }

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

  // --- Logic Helpers ---
  const applyPoseToRef = (pose: PoseData, group: THREE.Group) => {
      group.traverse((obj) => {
          if (obj.userData.isJoint && obj.userData.id && pose[obj.userData.id]) {
             const { x, y, z } = pose[obj.userData.id];
             obj.rotation.set(x, y, z);
          }
      });
  };

  const generateRandomPose = () => {
     const pose: PoseData = {};
     for (let i = 0; i < 8; i++) {
        pose[`limb_${i}_joint_1`] = { 
            x: (Math.random() - 0.5) * 3, 
            y: (Math.random() - 0.5) * 3, 
            z: (Math.random() - 0.5) * 3 
        };
        pose[`limb_${i}_joint_2`] = { 
            x: (Math.random() - 0.5) * 3, 
            y: (Math.random() - 0.5) * 3, 
            z: (Math.random() - 0.5) * 3 
        };
     }
     if (creatureRef.current) applyPoseToRef(pose, creatureRef.current);
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

  // --- Interactions ---
  const handlePointerDown = (e: React.PointerEvent) => {
    // Basic Raycast setup
    const rect = rendererRef.current!.domElement.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current!);
    
    // Check intersection
    const intersects = raycasterRef.current.intersectObjects(creatureRef.current!.children, true);
    const hit = intersects.find(i => i.object.userData.isPart);

    // Initial Pointer Track
    previousPointerRef.current = { x: e.clientX, y: e.clientY };

    // --- LOGIC BRANCHING ---

    // 1. ORBIT MODE: Always orbit, but allow selecting.
    if (mode === 'orbit') {
        if (hit) selectJoint(hit.object as THREE.Mesh);
        // Controls handle orbit automatically
        return; 
    }

    // 2. GRAB MODE: Dragging rotates selected joint (Remote Control).
    if (mode === 'grab') {
        if (hit) {
            selectJoint(hit.object as THREE.Mesh);
            isDraggingRef.current = true;
            if (controlsRef.current) controlsRef.current.enabled = false;
        } else if (selectedId) {
            // Dragging background while something selected -> Remote Rotate
            isDraggingRef.current = true;
            if (controlsRef.current) controlsRef.current.enabled = false;
        }
        return;
    }

    // 3. FREE MODE: Smart Interaction (Lever Drag or Orbit).
    if (mode === 'free') {
        if (hit) {
            // Start Lever Drag
            const mesh = hit.object as THREE.Mesh;
            selectJoint(mesh);
            isDraggingRef.current = true;
            if (controlsRef.current) controlsRef.current.enabled = false;
            
            // Setup Drag Plane
            const wrapper = mesh.parent;
            if (wrapper) {
               const jointWorldPos = new THREE.Vector3();
               wrapper.getWorldPosition(jointWorldPos);
               jointWorldPosRef.current.copy(jointWorldPos);

               const camDir = new THREE.Vector3();
               cameraRef.current!.getWorldDirection(camDir);
               dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, jointWorldPos);
               
               const planeIntersect = new THREE.Vector3();
               raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, planeIntersect);
               
               if (planeIntersect) {
                   dragStartPointRef.current.copy(planeIntersect);
                   dragStartVectorRef.current.subVectors(planeIntersect, jointWorldPos).normalize();
               }
            }
        }
        // Else Orbit (handled by controls)
    }
    
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (!selectedMeshRef.current) return;

      const wrapper = selectedMeshRef.current.parent;
      if (!wrapper || !wrapper.userData.isJoint) return;

      // GRAB MODE: Screen Space Rotation (Trackball style)
      if (mode === 'grab') {
          const deltaX = e.clientX - previousPointerRef.current.x;
          const deltaY = e.clientY - previousPointerRef.current.y;
          previousPointerRef.current = { x: e.clientX, y: e.clientY };

          const sensitivity = 0.005;
          const cam = cameraRef.current!;
          const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
          const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);

          const rotX = new THREE.Quaternion().setFromAxisAngle(camRight, deltaY * sensitivity);
          const rotY = new THREE.Quaternion().setFromAxisAngle(camUp, deltaX * sensitivity);
          const deltaQ = rotY.multiply(rotX);
          
          const currentWorldQ = new THREE.Quaternion();
          wrapper.getWorldQuaternion(currentWorldQ);
          const newWorldQ = deltaQ.multiply(currentWorldQ);
          
          const parent = wrapper.parent;
          const parentWorldQ = new THREE.Quaternion();
          if (parent) parent.getWorldQuaternion(parentWorldQ);
          wrapper.quaternion.copy(parentWorldQ.invert().multiply(newWorldQ));
          return;
      }

      // FREE MODE: Lever Drag
      if (mode === 'free') {
          const rect = rendererRef.current!.domElement.getBoundingClientRect();
          const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycasterRef.current.setFromCamera(new THREE.Vector2(nx, ny), cameraRef.current!);

          const planeIntersect = new THREE.Vector3();
          raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, planeIntersect);

          if (planeIntersect) {
              const currentVector = new THREE.Vector3().subVectors(planeIntersect, jointWorldPosRef.current).normalize();
              const startVector = dragStartVectorRef.current;
              
              const deltaQ = new THREE.Quaternion().setFromUnitVectors(startVector, currentVector);
              
              const currentWorldQ = new THREE.Quaternion();
              wrapper.getWorldQuaternion(currentWorldQ);
              
              const newWorldQ = deltaQ.multiply(currentWorldQ);
              
              const parent = wrapper.parent;
              const parentWorldQ = new THREE.Quaternion();
              if (parent) parent.getWorldQuaternion(parentWorldQ);
              wrapper.quaternion.copy(parentWorldQ.invert().multiply(newWorldQ));
              
              dragStartVectorRef.current.copy(currentVector);
          }
      }
  };

  const handlePointerUp = () => {
      isDraggingRef.current = false;
      if (controlsRef.current) controlsRef.current.enabled = true;
  };

  const selectJoint = (mesh: THREE.Mesh) => {
      if (selectedMeshRef.current) selectedMeshRef.current.material = limbMaterialRef.current;
      selectedMeshRef.current = mesh;
      selectedMeshRef.current.material = highlightMaterialRef.current;
      if (mesh.parent && mesh.parent.userData.isJoint) {
          setSelectedId(mesh.parent.userData.id);
      }
  };

  // --- Dynamic Theme ---
  useEffect(() => {
    const palette = COLORS[theme];
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(palette.bg);
      if (sceneRef.current.fog) (sceneRef.current.fog as THREE.FogExp2).color.setHex(palette.fog);
    }
    limbMaterialRef.current.color.setHex(palette.limb);
    highlightMaterialRef.current.color.setHex(palette.limb);
    highlightMaterialRef.current.emissive.setHex(theme === 'dark' ? 0xff3b30 : 0xff453a); 
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

  // --- Utils ---
  const resetPose = () => { if (creatureRef.current) applyPoseToRef(INITIAL_POSE, creatureRef.current); };
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
      localStorage.setItem(CACHE_KEY, json);
      try {
          await navigator.clipboard.writeText(json);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      } catch (err) { console.error(err); }
  };

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-black text-white' : 'bg-[#F2F2F7] text-black';
  
  // UI Styles
  const primaryBtnClass = (active: boolean) => 
    `flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold tracking-widest text-xs uppercase transition-all active:scale-95 shadow-lg ${
      active 
       ? (isDark ? 'bg-white text-black' : 'bg-black text-white') 
       : (isDark ? 'bg-neutral-900 text-neutral-400' : 'bg-white text-neutral-400')
    }`;
  
  const secondaryBtnClass = 
    `flex items-center justify-center p-3 rounded-full transition-all active:scale-90 ${
        isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-black'
    }`;
  
  const pillContainerClass = 
    `flex items-center p-1 rounded-2xl shadow-sm border backdrop-blur-md ${
        isDark ? 'bg-neutral-900/80 border-white/5' : 'bg-white/80 border-black/5'
    }`;

  const wideBtnClass = 
    `w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold tracking-widest text-xs uppercase shadow-sm border transition-all active:scale-95 ${
        isDark ? 'bg-neutral-900 text-white border-white/5' : 'bg-white text-black border-black/5'
    }`;

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

       {/* Top Label */}
       <div className={`absolute top-0 left-0 right-0 p-4 pt-[max(1.5rem,env(safe-area-inset-top))] flex justify-center pointer-events-none transition-opacity duration-300 z-40 ${selectedId ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`px-4 py-1.5 rounded-full backdrop-blur-xl text-[10px] font-bold tracking-widest uppercase shadow-lg border ${
             isDark ? 'bg-white/10 text-white border-white/10' : 'bg-white/70 text-black border-black/5'
          }`}>
             {selectedId ? selectedId.replace(/_/g, ' ') : ''}
          </div>
       </div>

       {/* Main Control Cluster */}
       <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-3 w-72 z-50">
            
            {/* 1. Mode Toggles */}
            <div className="grid grid-cols-2 gap-3 h-16">
                 <button onClick={() => setMode('orbit')} className={primaryBtnClass(mode === 'orbit')}>
                    <Eye size={18} strokeWidth={2.5} />
                    <span>Orbit</span>
                 </button>
                 <button onClick={() => setMode('grab')} className={primaryBtnClass(mode === 'grab')}>
                    <Hand size={18} strokeWidth={2.5} />
                    <span>Grab</span>
                 </button>
            </div>

            {/* 2. Tools & Free Mode */}
            <div className="grid grid-cols-[1.5fr_1fr] gap-3 h-14">
                 <div className={`${pillContainerClass} justify-around px-2`}>
                      <button onClick={copyPose} className={secondaryBtnClass}>
                          {copied ? <Check size={18} className="text-green-500"/> : <Copy size={18} />}
                      </button>
                      <button onClick={generateRandomPose} className={secondaryBtnClass}>
                          <Shuffle size={18} />
                      </button>
                      <button onClick={saveSnapshot} className={secondaryBtnClass}>
                          <Download size={18} />
                      </button>
                 </div>
                 
                 <button onClick={() => setMode('free')} className={`${primaryBtnClass(mode === 'free')} !px-0`}>
                    <Grid3x3 size={18} strokeWidth={2.5} />
                    <span>Free</span>
                 </button>
            </div>

            {/* 3. Reset Button */}
            <button onClick={resetPose} className={wideBtnClass}>
                <RefreshCcw size={16} strokeWidth={2.5} />
                <span>Reset</span>
            </button>

       </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);