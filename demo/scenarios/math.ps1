# Operator precedence and @ option values. Line numbers refer to workspace/lecar.ode as edited so far.

# 1. a sign where XPP allows none: the file would not load; the quick fix brackets it
ClickEnd 21
Burst "`naux e1=2*-vbar"; Pause 1500
HoverAt 22 12 4000
Click; Key '^.' 1200; Key '{ENTER}' 1800

# 2. comparisons bind tighter than arithmetic: 2*3<4 is 2*(3<4)
ClickEnd 22
Burst "`naux e2=2*3<4"; Pause 1500
HoverAt 23 11 4500

# 3. unary minus binds more weakly than ^: -vbar^2 is -(vbar^2)
ClickEnd 23
Burst "`naux e3=-vbar^2"; Pause 1500
HoverAt 24 13 4000

# 4. @ values are plain numbers: total=2*500 is 2
SelectWord 26 10
Burst '2*500'; Pause 1500
HoverAt 26 10 4000
