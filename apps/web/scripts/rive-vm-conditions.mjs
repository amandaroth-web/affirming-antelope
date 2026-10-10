// Rewrites state-machine input conditions into data-bound view-model conditions.
//
// rive-mcp-server (0.6.x) authors classic state-machine inputs (StateMachineNumber/Trigger/Bool)
// and view models, but not transition conditions that read a view-model property. Rive's new
// runtimes (including @rive-app/react-native's default iOS backend) drive state machines only
// through data binding; SMI inputs throw there. This pass rewrites every input condition into
//
//   TransitionViewModelCondition { opValue }
//   BindableProperty{Number|Trigger|Boolean}
//   DataBindContext { propertyKey: <bindable>.propertyValue, sourcePathIds: [vm, prop] }
//   TransitionPropertyViewModelComparator            (left: the bindable above)
//   TransitionValue{Number|Trigger|Boolean}Comparator (right: the constant)
//
// and drops the inputs. The order matters: the runtime links a property comparator to the most
// recently imported BindableProperty (an import-stack lookup); bindablePropertyId is ignored.
// A comparator with no bindable before it fails to import ("Failed to import object of type 479").
// Verified against the official WASM runtime with scripts/rive-harness.mjs (number ==, trigger).
//
// View-model property names must equal the input names used in the scene spec.

const INPUT_TYPES = { StateMachineNumber: "number", StateMachineTrigger: "trigger", StateMachineBool: "bool" };
const BINDABLE = { number: "BindablePropertyNumber", trigger: "BindablePropertyTrigger", bool: "BindablePropertyBoolean" };

/**
 * @param {{type: string, props: object}[]} objects buildScene() output
 * @param {{ vmIndex: number, propIndex: Map<string, number>, propKeyOf: (type: string, prop: string) => number,
 *           encodeIds: (ids: number[]) => Uint8Array }} opts
 */
export function bindConditions(objects, opts) {
  const out = [];
  let inputs = [];
  for (const o of objects) {
    if (o.type === "StateMachine") inputs = [];
    if (o.type in INPUT_TYPES) {
      inputs.push({ name: o.props.name, type: INPUT_TYPES[o.type] });
      continue;
    }
    if (o.type === "TransitionNumberCondition" || o.type === "TransitionTriggerCondition" || o.type === "TransitionBoolCondition") {
      const inp = inputs[o.props.inputId];
      const pi = opts.propIndex.get(inp.name);
      if (pi === undefined) throw new Error(`view model has no property '${inp.name}'`);
      const bindable = BINDABLE[inp.type];
      // TransitionBoolCondition encodes "== true" as op 0 and "== false" as op 1; express both as == value.
      const op = inp.type === "bool" ? 0 : (o.props.opValue ?? 0);
      out.push(
        { type: "TransitionViewModelCondition", props: { opValue: op } },
        { type: bindable, props: {} },
        {
          type: "DataBindContext",
          props: { propertyKey: opts.propKeyOf(bindable, "propertyValue"), flags: 0, sourcePathIds: opts.encodeIds([opts.vmIndex, pi]) },
        },
        { type: "TransitionPropertyViewModelComparator", props: {} },
        inp.type === "number"
          ? { type: "TransitionValueNumberComparator", props: { value: o.props.value ?? 0 } }
          : inp.type === "trigger"
            ? { type: "TransitionValueTriggerComparator", props: {} }
            : { type: "TransitionValueBooleanComparator", props: { value: (o.props.opValue ?? 0) === 0 } },
      );
      continue;
    }
    out.push(o);
  }
  return out;
}
