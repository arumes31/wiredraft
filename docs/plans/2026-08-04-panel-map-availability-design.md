# Panel Map availability feedback

## Outcome

The toolbar action is named **PANEL MAP**. It remains clickable regardless of the number of installed patch panels, because disabling it hides the reason the operation is unavailable.

On activation, the application evaluates the current topology:

- zero panels: show an alert explaining that two panels must be installed with **+ PANEL**;
- one panel: show an alert explaining that one additional panel is required;
- two or more panels: open the existing backport range-mapping dialog.

The same availability result supplies the button title and accessible label. The alert uses the existing error toast queue, which provides an assertive `role="alert"` without adding another modal or changing the successful Panel Map workflow.

## Verification

Unit coverage validates the zero-, one-, and two-panel states. Static UI checks protect the PANEL MAP label and ensure the action is not disabled before its feedback path can run. The browser workflow verifies visible alerts for empty and single-panel maps and normal dialog opening once two panels exist.
