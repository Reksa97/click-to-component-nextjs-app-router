/**
 * @typedef {import('./types').ClickToComponentProps} Props
 * @typedef {import('./types').Coords} Coords
 */

import { FloatingPortal } from '@floating-ui/react-dom-interactions'
import { html } from 'htm/react'
import * as React from 'react'

import { ContextMenu } from './ContextMenu.js'
import { getPathToSource } from './getPathToSource.js'
import { getReactInstancesForElement } from './getReactInstancesForElement.js'
import { getSourceForInstance } from './getSourceForInstance.js'
import { getUrl } from './getUrl.js'

export const State = /** @type {const} */ ({
  IDLE: 'IDLE',
  HOVER: 'HOVER',
  SELECT: 'SELECT',
})

/**
 * @param {Props} props
 */
export function ClickToComponent({ editor = 'vscode', pathModifier }) {
  const [state, setState] = React.useState(
    /** @type {State[keyof State]} */
    (State.IDLE)
  )

  const [target, setTarget] = React.useState(
    /** @type {HTMLElement | null} */
    (null)
  )

  const onClick = React.useCallback(
    function handleClick(
      /**
       * @type {MouseEvent}
       */
      event
    ) {
      if (state === State.HOVER && target instanceof HTMLElement) {
        const instance = getReactInstancesForElement(target).find((instance) =>
          getSourceForInstance(instance)
        )

        if (!instance) {
          return console.warn(
            'Could not find React instance for element',
            target
          )
        }

        const source = getSourceForInstance(instance)

        if (!source) {
          return console.warn(
            'Could not find source for React instance',
            instance
          )
        }
        const path = getPathToSource(source, pathModifier)
        const url = getUrl({
          editor,
          pathToSource: path,
        })

        event.preventDefault()
        window.location.assign(url)

        setState(State.IDLE)
      }
    },
    [editor, pathModifier, state, target]
  )

  const onClose = React.useCallback(
    function handleClose(returnValue) {
      if (returnValue) {
        const url = getUrl({
          editor,
          pathToSource: returnValue,
        })

        window.location.assign(url)
      }

      setState(State.IDLE)
    },
    [editor]
  )

  const onContextMenu = React.useCallback(
    function handleContextMenu(
      /**
       * @type {MouseEvent}
       */
      event
    ) {
      const { target } = event

      if (state === State.HOVER && target instanceof HTMLElement) {
        event.preventDefault()

        setState(State.SELECT)
        setTarget(target)
      }
    },
    [state]
  )

  const onKeyDown = React.useCallback(
    function handleKeyDown(
      /**
       * @type {KeyboardEvent}
       */
      event
    ) {
      switch (state) {
        case State.IDLE:
          if (event.altKey) setState(State.HOVER)
          break

        default:
      }
    },
    [state]
  )

  const onKeyUp = React.useCallback(
    function handleKeyUp(
      /**
       * @type {KeyboardEvent}
       */
      event
    ) {
      switch (state) {
        case State.HOVER:
          setState(State.IDLE)
          break

        default:
      }
    },
    [state]
  )

  const onMouseMove = React.useCallback(
    function handleMouseMove(
      /** @type {MouseEvent} */
      event
    ) {
      if (!(event.target instanceof HTMLElement)) {
        return
      }

      switch (state) {
        case State.IDLE:
        case State.HOVER:
          setTarget(event.target)
          break

        default:
          break
      }
    },
    [state]
  )

  const onBlur = React.useCallback(
    function handleBlur() {
      switch (state) {
        case State.HOVER:
          setState(State.IDLE)
          break

        default:
      }
    },
    [state]
  )

  React.useEffect(
    function toggleIndicator() {
      for (const element of Array.from(
        document.querySelectorAll('[data-click-to-component-target]')
      )) {
        if (element instanceof HTMLElement) {
          delete element.dataset.clickToComponentTarget
        }
      }

      if (state === State.IDLE) {
        delete window.document.body.dataset.clickToComponent
        if (target) {
          delete target.dataset.clickToComponentTarget
        }
        return
      }

      if (target instanceof HTMLElement) {
        window.document.body.dataset.clickToComponent = state
        target.dataset.clickToComponentTarget = state
      }
    },
    [state, target]
  )

  React.useEffect(
    function syncHighlightOverlay() {
      if (!(target instanceof HTMLElement) || state === State.IDLE) {
        const style = window.document.body.style
        style.removeProperty('--click-to-component-highlight-left')
        style.removeProperty('--click-to-component-highlight-top')
        style.removeProperty('--click-to-component-highlight-width')
        style.removeProperty('--click-to-component-highlight-height')
        style.removeProperty('--click-to-component-highlight-radius')
        style.removeProperty('--click-to-component-outline-width')
        return undefined
      }

      let animationFrameId = 0
      let resizeObserver

      const outlineWidthFromCSS = Number.parseFloat(
        window
          .getComputedStyle(window.document.body)
          .getPropertyValue('--click-to-component-outline-width') || '0'
      )

      const outlineWidth = Number.isFinite(outlineWidthFromCSS)
        ? outlineWidthFromCSS
        : 4

      const updateHighlight = () => {
        if (!(target instanceof HTMLElement)) {
          return
        }

        const rect = target.getBoundingClientRect()
        const computed = window.getComputedStyle(target)

        const style = window.document.body.style
        style.setProperty(
          '--click-to-component-highlight-left',
          `${rect.left - outlineWidth}px`
        )
        style.setProperty(
          '--click-to-component-highlight-top',
          `${rect.top - outlineWidth}px`
        )
        style.setProperty(
          '--click-to-component-highlight-width',
          `${rect.width + outlineWidth * 2}px`
        )
        style.setProperty(
          '--click-to-component-highlight-height',
          `${rect.height + outlineWidth * 2}px`
        )
        style.setProperty(
          '--click-to-component-highlight-radius',
          computed.borderRadius || '0px'
        )
        style.setProperty(
          '--click-to-component-outline-width',
          `${outlineWidth}px`
        )
      }

      const tick = () => {
        updateHighlight()
        animationFrameId = window.requestAnimationFrame(tick)
      }

      tick()

      window.addEventListener('scroll', updateHighlight, true)
      window.addEventListener('resize', updateHighlight)

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => updateHighlight())
        resizeObserver.observe(target)
      }

      return () => {
        window.cancelAnimationFrame(animationFrameId)

        window.removeEventListener('scroll', updateHighlight, true)
        window.removeEventListener('resize', updateHighlight)

        if (resizeObserver) {
          resizeObserver.disconnect()
        }

        const style = window.document.body.style
        style.removeProperty('--click-to-component-highlight-left')
        style.removeProperty('--click-to-component-highlight-top')
        style.removeProperty('--click-to-component-highlight-width')
        style.removeProperty('--click-to-component-highlight-height')
        style.removeProperty('--click-to-component-highlight-radius')
        style.removeProperty('--click-to-component-outline-width')
      }
    },
    [state, target]
  )

  React.useEffect(
    function addEventListenersToWindow() {
      window.addEventListener('click', onClick, { capture: true })
      window.addEventListener('contextmenu', onContextMenu, { capture: true })
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('blur', onBlur)

      return function removeEventListenersFromWindow() {
        window.removeEventListener('click', onClick, { capture: true })
        window.removeEventListener('contextmenu', onContextMenu, {
          capture: true,
        })
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('blur', onBlur)
      }
    },
    [onClick, onContextMenu, onKeyDown, onKeyUp, onMouseMove, onBlur]
  )

  return html`
    <style key="click-to-component-style">
      [data-click-to-component] * {
        pointer-events: auto !important;
      }

      [data-click-to-component-target] {
        cursor: var(--click-to-component-cursor, context-menu) !important;
        outline: var(
          --click-to-component-outline,
          2px solid rgba(99, 102, 241, 0.5)
        ) !important;
        outline-offset: 2px !important;
      }

      body[data-click-to-component='HOVER']::after,
      body[data-click-to-component='SELECT']::after {
        content: '';
        pointer-events: none;
        position: fixed;
        left: var(
          --click-to-component-highlight-left,
          -9999px
        );
        top: var(--click-to-component-highlight-top, -9999px);
        width: var(--click-to-component-highlight-width, 0px);
        height: var(--click-to-component-highlight-height, 0px);
        border-radius: var(--click-to-component-highlight-radius, 0px);
        z-index: 2147483647;
        box-sizing: border-box;
        border: var(
            --click-to-component-outline-width,
            4px
          )
          solid transparent;
        border-image: var(
            --click-to-component-outline-gradient,
            linear-gradient(135deg, #38bdf8, #a855f7, #f97316)
          )
          1;
        box-shadow: var(
          --click-to-component-outline-shadow,
          0 12px 30px rgba(59, 130, 246, 0.35)
        );
        transition: var(
          --click-to-component-outline-transition,
          transform 120ms ease, width 120ms ease, height 120ms ease
        );
      }
    </style>

    <${FloatingPortal} key="click-to-component-portal">
      ${html`<${ContextMenu}
        key="click-to-component-contextmenu"
        onClose=${onClose}
        pathModifier=${pathModifier}
      />`}
    </${FloatingPortal}
  `
}
