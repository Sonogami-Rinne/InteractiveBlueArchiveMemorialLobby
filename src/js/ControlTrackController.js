// ControlPlayableAsset activation is applied to the entire GameObject subtree.
// Particle simulation follows clip time, independently of the normal scene tick.
export default class ControlTrackController {
    constructor(clips, hierarchy, controllers) {
        this.hierarchy = hierarchy;
        this.targets = controllers.flatMap(controller => controller.getControlTargets?.() ?? []);
        this.groups = [];
        this.epoch = 0;
        this.time = -Infinity;
        for (const clip of [...clips].sort((a, b) => a.start - b.start)) {
            if (clip.gameObject == null) continue;
            if (!hierarchy.node(clip.gameObject)) throw new Error(`ControlTrack GameObject ${clip.gameObject} was not exported`);
            let group = this.groups.find(group => group.gameObject === clip.gameObject);
            if (!group) {
                group = { gameObject: clip.gameObject, clips: [], targets: this.targets.filter(target =>
                    hierarchy.contains(clip.gameObject, target.gameObject)) };
                this.groups.push(group);
            }
            group.clips.push(clip);
            if (clip.updateParticle) {
                for (const controller of controllers) {
                    controller.manageControlParticles?.(clip.gameObject, clip.searchHierarchy);
                }
            }
        }
        this.hasActivation = this.groups.some(group => group.clips.some(clip => clip.active));
        this.applyVisibility(new Map(this.groups.map(group => [group, group.clips.some(clip => clip.active) ? false : true])));
    }

    applyVisibility(states) {
        for (const [group, visible] of states) {
            if (group.clips.some(clip => clip.active)) this.hierarchy.setControlActive(group.gameObject, visible);
        }
    }

    reset() {
        this.epoch++;
        this.time = -Infinity;
    }

    update(time) {
        if (time < this.time) this.reset();
        this.time = time;
        const states = new Map();
        const simulations = new Map();
        for (const group of this.groups) {
            const active = group.clips.filter(clip => time >= clip.start && time < clip.start + clip.duration);
            if (group.clips.some(clip => clip.active)) states.set(group, active.some(clip => clip.active));
            const clip = active.findLast(clip => clip.updateParticle);
            if (!clip) continue;
            for (const target of group.targets) {
                if (target.seek && target.isManagedBy?.(group.gameObject, clip.searchHierarchy)) {
                    simulations.set(target, { clip, time: (clip.clipIn ?? 0) + (time - clip.start) * (clip.timeScale ?? 1) });
                }
            }
        }
        this.applyVisibility(states);
        for (const [target, state] of simulations) {
            if (target.getVisible()) target.seek(state.time, state.clip, this.epoch);
        }
    }

    stop() {
        const states = new Map(this.groups.map(group => {
            const clip = group.clips.at(-1);
            const visible = clip.postPlayback === 0 || (clip.postPlayback === 2 && clip.initialActive);
            return [group, group.clips.some(clip => clip.active) ? visible : true];
        }));
        this.applyVisibility(states);
        this.reset();
    }
}
