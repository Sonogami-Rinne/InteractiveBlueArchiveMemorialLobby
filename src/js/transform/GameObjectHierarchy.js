import { fromAffine2D, fromTRS, inverse, multiply, project } from './common.js'

const identity = () => fromAffine2D([1, 0, 0, 1, 0, 0]);
// The exporter writes rows; runtime matrices are column-major.
const readMatrix = rows => rows[0].map((_, column) => rows.map(row => row[column])).flat();
const authoredMatrix = node => fromTRS(node.position, node.rotation, node.scale);
const unityFromPixi = ({ a, b, c, d, tx, ty }) => fromAffine2D([a, -b, -c, d, tx, -ty]);

export default class GameObjectHierarchy {
    constructor(scene, entries = {}) {
        this.scene = scene;
        this.entries = entries;
        this.nodes = new Map();
        this.bones = [];
        this.projected = new PIXI.Matrix();
        for (const id of Object.keys(entries)) this.node(id);
    }

    node(id) {
        id = String(id);
        const existing = this.nodes.get(id);
        if (existing) return existing;
        const entry = this.entries[id];
        if (!entry?.hierarchy) return null;
        const parent = this.node(entry.parent);
        const node = {
            id, entry, parent, views: [], spatialViews: new Set(), active: Boolean(entry.active),
            restWorld: readMatrix(entry.matrix),
            position: [...entry.localPosition], rotation: [...entry.localRotation], scale: [...entry.localScale],
        };
        this.nodes.set(id, node);
        return node;
    }

    initialize(spineController) {
        for (const node of this.nodes.values()) {
            const { entry, parent, restWorld } = node;
            node.restLocal = authoredMatrix(node);
            node.localTransform = node.restLocal;
            node.worldTransform = restWorld;
            if (parent) {
                node.toParent = entry.transformToParent === null ? identity() : readMatrix(entry.transformToParent);
            } else {
                const localInverse = inverse(node.restLocal);
                node.toParent = localInverse ? multiply(restWorld, localInverse) : identity();
                if (!localInverse) node.singularRest = restWorld;
            }
        }
        this.bindBones(spineController);
        this.updateTransforms();
    }

    // Returns a column-major Unity matrix. Callers can keep their own copy.
    getWorldTransform(id) {
        return this.nodes.get(String(id))?.worldTransform?.slice() ?? null;
    }

    getLocalTransform(id) {
        return this.nodes.get(String(id))?.localTransform?.slice() ?? null;
    }

    attach(id, view, sorted = false) {
        const node = this.nodes.get(String(id));
        if (!node) return false;
        const anchor = new PIXI.Container({ label: node.entry.hierarchy });
        this.scene.addChild(anchor);
        anchor.addChild(view);
        if (sorted) {
            anchor.zIndex = view.zIndex;
        }
        const attachment = { anchor, view, rest: project(node.restWorld, new PIXI.Matrix()).invert() };
        node.views.push(attachment);
        view.once('destroyed', () => {
            node.views.splice(node.views.indexOf(attachment), 1);
            anchor.destroy();
        });
        return true;
    }

    attachSpatial(id, view) {
        const node = this.node(id);
        if (!node) return false;
        view.setMeshWorldTransform(node.worldTransform ?? node.restWorld);
        view.renderable = this.active(id);
        this.scene.addChild(view);
        node.spatialViews.add(view);
        view.once('destroyed', () => node.spatialViews.delete(view));
        return true;
    }

    contains(root, id) {
        const ancestor = this.nodes.get(String(root));
        for (let node = this.nodes.get(String(id)); node; node = node.parent) {
            if (node === ancestor) return true;
        }
        return false;
    }

    active(id) {
        for (let node = this.nodes.get(String(id)); node; node = node.parent) {
            if (node.entry.couldActive === false || !(node.controlActive ?? node.active)) return false;
        }
        return true;
    }

    setControlActive(id, value) {
        const node = this.nodes.get(String(id));
        if (node) node.controlActive = value;
    }

    handleTimelineEvent(id, property, value) {
        const node = this.nodes.get(String(id));
        if (!node) return false;
        if (property === 'm_IsActive') {
            node.active = Boolean(value);
            return true;
        }
        const match = /^m_Local(Position|Scale|Rotation)\.([xyzw])$/.exec(property);
        if (!match) return false;
        const field = match[1].toLowerCase();
        const axis = 'xyzw'.indexOf(match[2]);
        const components = node[field];
        if (axis < components.length) {
            components[axis] = value;
            node.localTransform = authoredMatrix(node);
        }
        return true;
    }

    bindBones(spineController) {
        const owners = spineController?.gameObjectMap ?? {};
        for (const node of this.nodes.values()) {
            if (!node.parent || owners[node.id]) continue;
            const ownerNode = this.findSpineAncestor(node.parent, owners);
            const owner = owners[ownerNode?.id];
            if (!owner) continue;
            const path = node.entry.hierarchy.split('/');
            const ownerDepth = ownerNode.entry.hierarchy.split('/').length;
            const skeletonRoot = path.indexOf('SkeletonUtility-SkeletonRoot', ownerDepth);
            if (skeletonRoot === -1) continue;
            const parentDepth = node.parent.entry.hierarchy.split('/').length;
            let bone = null;
            let previousBone = null;
            // Follow Spine's actual parent chain. Objects mounted under a bone
            // can have names like "root" without being part of the skeleton.
            for (let i = skeletonRoot + 1; i < path.length; i++) {
                const candidate = owner.skeleton.findBone(path[i]);
                if (!candidate || candidate.parent !== previousBone) break;
                previousBone = candidate;
                if (i >= parentDepth) bone = candidate;
            }
            if (!bone) continue;
            const sceneInverse = this.scene.getGlobalTransform(new PIXI.Matrix()).invert();
            const ownerScene = owner.getGlobalTransform(new PIXI.Matrix()).prepend(sceneInverse);
            const ownerRest = ownerNode.restWorld;
            const basis = multiply(inverse(ownerRest) ?? identity(), unityFromPixi(ownerScene));
            const boneRest = multiply(multiply(ownerRest, basis), this.boneMatrix(bone));
            const boneInverse = inverse(boneRest);
            if (!boneInverse) continue;
            const offset = multiply(boneInverse, multiply(node.restWorld, inverse(node.restLocal) ?? identity()));
            const binding = { node, bone, owner, ownerNode, basis, offset };
            node.bone = binding;
            this.bones.push(binding);
        }
    }

    findSpineAncestor(node, owners) {
        while (node && !owners[node.id]) node = node.parent;
        return node;
    }

    boneMatrix(bone) {
        return fromAffine2D([bone.a, -bone.c, -bone.b, bone.d, bone.worldX, -bone.worldY]);
    }

    updateTransforms() {
        for (const node of this.nodes.values()) {
            const binding = node.bone;
            if (binding) {
                const boneWorld = multiply(multiply(binding.ownerNode.worldTransform, binding.basis), this.boneMatrix(binding.bone));
                node.worldTransform = multiply(multiply(boneWorld, binding.offset), node.localTransform);
            } else {
                const local = node.singularRest
                    ? node.singularRest.map((value, i) => value + node.localTransform[i] - node.restLocal[i])
                    : multiply(node.toParent, node.localTransform);
                node.worldTransform = node.parent ? multiply(node.parent.worldTransform, local) : local;
            }
            for (const { anchor, rest } of node.views) {
                anchor.visible = this.active(node.id);
                anchor.setFromMatrix(project(node.worldTransform, this.projected).append(rest));
            }
            for (const view of node.spatialViews) {
                view.renderable = this.active(node.id);
                view.setMeshWorldTransform(node.worldTransform);
            }
        }
    }

    updateParticle({ gameObject, particleContainer }) {
        const world = this.nodes.get(String(gameObject))?.worldTransform;
        if (world) particleContainer.setEmitterWorldMatrix(world);
        return world?.[14];
    }
}
