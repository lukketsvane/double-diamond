import React, { useRef, useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { 
  Hand, 
  Eye, 
  RotateCcw, 
  Copy,
  Check,
  Shuffle
} from "lucide-react";

// --- Types ---
type PoseData = Record<string, {x: number, y: number, z: number}>;

// --- Constants ---
const INITIAL_POSE: PoseData = {
  "limb_0_joint_1": { "x": 1.015, "y": 0.648, "z ": 0.123 },
  "limb_0_joint_2": { "x": -2.976, "y": -0.537, "z": 1.043 },
  "limb_1_joint_1": { "x": 0.092, "y": 0.593, "z": -2.637 },
  "limb_1_j by oint_2": { "x": 0, "y": 0, "z": -2.094 },
  "limb_2_joint_1": { "x": 0.429, "y": 0.239, "z": 0.768 },
  "limb_2_joint_2": { "x": 2.287, "y": -0.829, "z": 0.755 },
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

// Generate Presets
const generatePreset = (type: string): PoseData => {
  const pose: PoseData = {};
  const limbCount = 8;
  for (let i = 0; i < limbCount; i++) {
    const isUpper = i < 4;
    // Helper to set joint
    const setJ = (j: 1 | 2, x: number, y: number, z: number) => {
      pose[`limb_${i}_joint_${j}`] = { x, y, z };
    };

    if (type === 'default') return INITIAL_POSE;
    
    if (type === 'standing') {
       // Legs down (4-7), Arms down (0-3)
       setJ(1, 0, 0, isUpper ? 2.5 : 0.2); 
       setJ(2, 0, 0, 0);
    } else if (type === 'sprawled') {
       // All flat out
       setJ(1, 0, 1.5, 0);
       setJ(2, 0, 0, 0);
    } else if (type === 'curled') {
       // Tight ball
       setJ(1, 1.5, 0, 2.0);
       setJ(2, -2.5, 0, 0);
    } else if (type === 't-pose') {
       // Straight out
       setJ(1, 0, 1.57, 0);
       setJ(2, 0, 0, 0);
    } else if (type === 'walking') {
       // Alternating
       const odd = i % 2 === 0;
       setJ(1, odd ? 0.5 : -0.5, 0, 0.5);
       setJ(2, odd ? 1.0 : 0.0, 0, 0);
    } else if (type === 'chaos') {
       setJ(1, Math.random()*2, Math.random()*2, Math.random()*2);
       setJ(2, Math.random()*2, Math.random()*2, Math.random()*2);
    } else if (type === 'alert') {
       // Upwards
       setJ(1, -0.5, 0, -0.5);
       setJ(2, -0.5, 0, 0);
    } else if (type === 'box') {
       // Folded 90 degs
       setJ(1, 0, 0, 1.57);
       setJ(2, 0, 0, 1.57);
    } else if (type === 'twisted') {
        setJ(1, 0, 2, i * 0.5);
        setJ(2, 0, 0, 0);
    } else {
        // Zero
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

const App = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // New State: Multi-mode support
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [poseEnabled, setPoseEnabled] = useState(true);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(true);
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

  // --- 3D Initialization ---
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
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
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0x4455ff, 1);
    backLight.position.set(-5, -5, -5);
    scene.add(backLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enabled = true; // Initial state
    controlsRef.current = controls;

    // --- Build Creature ---
    const creatureGroup = new THREE.Group();
    creatureRef.current = creatureGroup;
    scene.add(creatureGroup);

    const limbMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xeeeeee, 
      roughness: 0.5, 
      metalness: 0.5 
    });
    const jointMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.1,
        metalness: 0.9
    });

    const angles = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
    
    const createLimb = (isUpper: boolean, angle: number, index: number) => {
        const pivotGroup = new THREE.Group();
        pivotGroup.rotation.y = angle;
        const verticalAngle = isUpper ? Math.PI / 4 : -Math.PI / 4;
        pivotGroup.rotation.z = verticalAngle;
        creatureGroup.add(pivotGroup);

        // Segment 1
        const seg1Length = 1.5;
        const seg1Geo = new THREE.BoxGeometry(0.2, seg1Length, 0.2);
        const seg1 = new THREE.Mesh(seg1Geo, limbMaterial);
        seg1.position.y = seg1Length / 2;
        seg1.userData = { isPart: true, partType: 'limb', limbIndex: index, segmentIndex: 1 };
        
        const seg1Wrapper = new THREE.Group();
        seg1Wrapper.userData = { isJoint: true, id: `limb_${index}_joint_1` };
        
        // Initial Pose
        const pose1 = INITIAL_POSE[`limb_${index}_joint_1`];
        if (pose1) seg1Wrapper.rotation.set(pose1.x, pose1.y, pose1.z);

        seg1Wrapper.add(seg1);
        pivotGroup.add(seg1Wrapper);
        
        const e1 = new THREE.EdgesGeometry(seg1Geo);
        const l1 = new THREE.LineSegments(e1, new THREE.LineBasicMaterial({ color: 0x888888 }));
        seg1.add(l1);

        const joint = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), jointMaterial);
        joint.position.y = seg1Length / 2;
        seg1.add(joint);

        // Segment 2
        const seg2Length = 2.0;
        const seg2Geo = new THREE.ConeGeometry(0.1, seg2Length, 4);
        const seg2 = new THREE.Mesh(seg2Geo, limbMaterial);
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
        const l2 = new THREE.LineSegments(e2, new THREE.LineBasicMaterial({ color: 0x888888 }));
        seg2.add(l2);
    };

    angles.forEach((angle, i) => createLimb(true, angle, i));
    angles.forEach((angle, i) => createLimb(false, angle, i + 4));

    // Animation Loop
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

  // Sync OrbitControls enabled state with React state when not dragging
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
    
    // Check for limb hit
    const intersects = raycasterRef.current.intersectObjects(creatureRef.current!.children, true);
    const hit = intersects.find(i => i.object.userData.isPart);
    
    // Logic: If we hit a limb AND pose is enabled, we grab it.
    // Otherwise, if orbit is enabled, we let orbit happen (by NOT stopping propagation).
    // If we grabbed, we must disable OrbitControls temporarily so it doesn't spin while we drag.

    if (hit && poseEnabled) {
        // Start Pose Drag
        isDraggingRef.current = true;
        
        // Temporarily disable orbit controls while dragging a limb
        if (controlsRef.current) controlsRef.current.enabled = false;
        
        previousPointerRef.current = { x: e.clientX, y: e.clientY };
        
        // Highlight selection
        if (selectedMeshRef.current) {
            (selectedMeshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
        }
        
        selectedMeshRef.current = hit.object as THREE.Mesh;
        (selectedMeshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0xff0000);
        
        const wrapper = selectedMeshRef.current.parent;
        if (wrapper && wrapper.userData.isJoint) {
           setSelectedId(wrapper.userData.id);
        }
        
        // IMPORTANT: Stop propagation to prevent OrbitControls (if enabled) from picking this up
        e.stopPropagation(); 
    } else {
        // Clicked background or disabled pose
        
        // Deselect if clicking empty space
        if (selectedMeshRef.current) {
            (selectedMeshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
            selectedMeshRef.current = null;
            setSelectedId(null);
        }

        // Handle Orbit Enable/Disable
        // OrbitControls is attached to the DOM element. If we don't stop propagation, it gets the event.
        if (controlsRef.current) {
            controlsRef.current.enabled = orbitEnabled;
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      // Only handle pose dragging here. Orbit is handled by OrbitControls internals.
      if (!isDraggingRef.current || !selectedMeshRef.current || !poseEnabled) return;
      
      const deltaX = e.clientX - previousPointerRef.current.x;
      const deltaY = e.clientY - previousPointerRef.current.y;
      previousPointerRef.current = { x: e.clientX, y: e.clientY };
      
      const wrapper = selectedMeshRef.current.parent;
      if (wrapper && wrapper.userData.isJoint) {
          const sensitivity = 0.008;
          // Inverted controls for natural feel
          wrapper.rotateX(-deltaY * sensitivity);
          wrapper.rotateZ(-deltaX * sensitivity);
      }
  };

  const handlePointerUp = () => {
      isDraggingRef.current = false;
      // Restore Orbit Controls if enabled
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

      // Cache to local storage
      try {
        localStorage.setItem('ment0_saved_pose', json);
      } catch (e) {
        console.warn("Could not cache pose");
      }

      // Copy to clipboard
      try {
          await navigator.clipboard.writeText(json);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      } catch (err) {
          console.error("Failed to copy pose", err);
      }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none text-white">
      <div 
        className="w-full h-full touch-none"
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Floating Toggle */}
      <div 
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 transition-all duration-500 z-50 ${
          !menuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        }`}
      >
        <button 
          onClick={() => setMenuOpen(true)}
          className="w-12 h-1.5 bg-neutral-800/80 rounded-full backdrop-blur-md active:bg-white/50 transition-colors"
        />
      </div>

      {/* Bento Grid Menu */}
      <div 
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-50 ${
          menuOpen ? "scale-100 opacity-100 translate-y-0" : "scale-90 opacity-0 translate-y-8 pointer-events-none"
        }`}
      >
        <div className="flex flex-col gap-2 w-[240px]">
            {/* Row 1: Toggles */}
            <div className="grid grid-cols-2 gap-2 h-16">
                <button 
                  onClick={() => setOrbitEnabled(!orbitEnabled)}
                  className={`rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border ${
                    orbitEnabled 
                    ? 'bg-neutral-800 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                    : 'bg-neutral-900/80 border-white/5 text-neutral-600'
                  }`}
                >
                    <Eye className="w-6 h-6" />
                    <span className="text-[10px] uppercase font-mono tracking-wider">Orbit</span>
                </button>
                <button 
                  onClick={() => setPoseEnabled(!poseEnabled)}
                  className={`rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border ${
                    poseEnabled 
                    ? 'bg-neutral-800 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                    : 'bg-neutral-900/80 border-white/5 text-neutral-600'
                  }`}
                >
                    <Hand className="w-6 h-6" />
                    <span className="text-[10px] uppercase font-mono tracking-wider">Grab</span>
                </button>
            </div>

            {/* Row 2: Actions */}
            <div className="grid grid-cols-2 gap-2 h-14">
                 {/* Split Copy/Random Button */}
                 <div className="grid grid-cols-2 gap-1 bg-neutral-900/60 backdrop-blur-xl rounded-2xl border border-white/5 p-1">
                    <button 
                        onClick={copyPose}
                        className="flex flex-col items-center justify-center rounded-xl hover:bg-white/10 active:scale-95 transition-all text-neutral-400 hover:text-white"
                        title="Copy to Clipboard & Cache"
                    >
                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    </button>
                    <button 
                        onClick={randomizePose}
                        className="flex flex-col items-center justify-center rounded-xl hover:bg-white/10 active:scale-95 transition-all text-neutral-400 hover:text-white"
                        title="Randomize Preset"
                    >
                        <Shuffle className="w-5 h-5" />
                    </button>
                 </div>

                 {/* Reset Button */}
                 <button 
                    onClick={resetPose}
                    className="bg-neutral-900/60 hover:bg-neutral-800 backdrop-blur-xl rounded-2xl border border-white/5 flex items-center justify-center active:scale-95 transition-all text-neutral-400 hover:text-white"
                 >
                    <RotateCcw className="w-5 h-5" />
                 </button>
            </div>

            {/* Status Indicator */}
             <div className="flex justify-center items-center gap-2 pt-1 opacity-50">
                <div className={`w-1.5 h-1.5 rounded-full ${selectedId ? 'bg-red-500' : 'bg-neutral-600'}`} />
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                    {selectedId ? selectedId.split('_').slice(0,3).join(' ') : 'READY'}
                </span>
             </div>

             {/* Close Handle */}
            <div className="flex justify-center pt-2 w-full" onClick={() => setMenuOpen(false)}>
                <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);