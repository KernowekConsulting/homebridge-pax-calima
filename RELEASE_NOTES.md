# SvaraHome 2.6.0-beta.1 — CO₂ Clear

Extra ventilation when CO₂ rises.

Cooking, company and everyday life can leave a room in need of more fresh air. CO₂ Clear brings your CO₂ sensor and fan together in Apple Home, so extra ventilation can carry on for longer when the room needs it.

## Give the room the time it needs

A timed Boost is useful when you know how long you want the fan to run. CO₂ Clear adds another choice: start extra ventilation when your sensor reports high CO₂, then return to normal when it reports an acceptable level.

Two Home automations connect the sensor to the new CO₂ Clear control: one to turn it on, another to turn it off. Once those are in place, SvaraHome keeps the fan going between the two.

## You stay in control

Need a quiet moment? Use Pause. Want to take over? Use the fan or Boost controls as usual. Your choice takes priority.

CO₂ Clear runs at 96% by default, within any lower limit you have chosen for your fan. It has a one-hour limit in case the sensor's all-clear never arrives. You can choose the speed and maximum running time in Plugin Config. After a Homebridge restart, it waits for a new request.

## Setting up your first CO₂ Clear automation

For this beta, we recommend **Controller for HomeKit** to create the all-clear automation. It is an additional app: Apple Home's own editor offers the Netatmo high-CO₂ trigger, but not the matching all-clear trigger. The beta uses Netatmo's existing CO₂ warning level.

The [CO₂ Clear setup guide](https://github.com/KernowekConsulting/homebridge-pax-calima/blob/v2.6.0-beta.1/docs/CO2-CLEAR-BETA.md) walks through both automations. Start with one sensor and one fan.

This is the first CO₂ Clear beta. We would like to learn how it works through everyday rises and falls in CO₂ before a wider release. Choose **2.6.0-beta.1** in Homebridge to try it; **2.5.2** remains the regular release.
