import { createSignal, onMount, Show } from 'solid-js';
import './App.css'
import { focusTrap } from "dags-solid-cdk/a11y";

function App() {
  const [showInput, setShowInput] = createSignal(true)

  onMount(() => {
    setTimeout(() => {
      setShowInput(false)
    }, 3000)
  })

  return (
    <div class='container'>
      <div class='input-group'>
        <input type="email" name="text" class="input" />
        <input type="email" name="text" class="input" />
        <input type="email" name="text" class="input" />
        <div ref={focusTrap} class='input-group inner-group'>
          <input type="email" name="text" class="input" />
          <Show when={showInput()}>
            <input type="email" name="text" class="input" />
          </Show>
          <input type="email" name="text" class="input" />
          <input type="email" name="text" class="input" />
          <input type="email" name="text" class="input" />
        </div>
        <input type="email" name="text" class="input" />
        <input type="email" name="text" class="input" />
        <input type="email" name="text" class="input" />
      </div>
    </div>
  )
}

export default App
