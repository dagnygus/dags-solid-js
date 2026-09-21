import './App.css';
import { createSignal, onMount, Show } from 'solid-js';
import { focusAutoCapture } from 'dags-solid-cdk/a11y';

function App() {

  const [count, setCount] = createSignal(0);

  onMount(() => {
    let increase = true;
    setInterval(() => {
      if (increase) {
        setCount((value) => ++value);
        if (count() === 4) { increase = false; }
      } else {
        setCount((value) => --value);
        if (count() === 0) { increase = true; }
      }
    }, 2000);

    // const timerId = setInterval(() => {
    //   setCount((value) => ++value);
    //   if (count() === 7) {
    //     clearInterval(timerId);
    //   }
    // }, 2000);
  })

  return (
    <div class='container'>
      <div class='input-group'>
        <Show when={count() > 0}>
          <input ref={focusAutoCapture} type="email" name="text" class="input" placeholder='FIRST'/>
        </Show>
        <Show when={count() > 1 && count() < 6}>
          <input ref={focusAutoCapture} type="email" name="text" class="input" placeholder='SECOND'/>
        </Show>
        <Show when={count() > 2 && count() < 5}>
          <input ref={focusAutoCapture} type="email" name="text" class="input" placeholder='THIRD'/>
        </Show>
        <Show when={count() > 3 && count() < 7}>
          <input ref={focusAutoCapture} type="email" name="text" class="input" placeholder='FOURTH'/>
        </Show>
      </div>
    </div>
  )
}

export default App
