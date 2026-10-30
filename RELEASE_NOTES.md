# SvaraHome 2.6.0-beta.2 — CO₂ Clear, clearer from the start

Extra ventilation when CO₂ rises. A little more help getting it ready.

CO₂ Clear brings your sensor and fan together in Apple Home, giving the room more time for extra ventilation. This beta makes the setup easier to follow and the choices in Plugin Config clearer.

## Two automations, one simple idea

**CO₂ high → CO₂ Clear On.**

**CO₂ acceptable → CO₂ Clear Off.**

The guide now walks through both rules, finding the new control and replacing an existing CO₂-to-Boost automation. For Netatmo’s all-clear rule, we recommend Controller for HomeKit, an additional app.

If you already set up both rules with beta.1, keep them. There is no need to create them again.

## Humidity still has its say

When CO₂ Clear ends, the fan returns to its own automatic ventilation. If the room is still humid, the fan can keep running as usual. The all-clear action ends CO₂ Clear’s extra ventilation; it does not pause the fan.

## Choices that are easier to find

Speed and maximum running time now sit together in Plugin Config. The shorter fan timer is tucked under advanced settings, where it can usually stay as it is.

The defaults remain 96% and a one-hour maximum, within any lower limit you have chosen for your fan. Your ordinary Fan, Boost and Pause controls still take priority.

Choose **2.6.0-beta.2** in Homebridge to try it. The [CO₂ Clear setup guide](https://github.com/KernowekConsulting/homebridge-pax-calima/blob/v2.6.0-beta.2/docs/CO2-CLEAR-BETA.md) has the walkthrough. We are continuing the everyday trial before a wider release; **2.5.2** remains the regular release.
