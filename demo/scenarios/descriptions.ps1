# Descriptions on hover. Line numbers refer to workspace/lecar.ode as edited so far.

# .xppsettings.json on the right, the model on the left
Key '^p' 500; TypeText '.xppsettings.json' 20; Pause 400; Key '{ENTER}' 800
Key '^%{RIGHT}' 900; Key '^1' 500

# 1. a comment after the code describes the name on its line
HoverAt 18 13

# 2. gk has none yet: "name: text" parts describe several names of one line
HoverAt 14 32 1800
ClickEnd 4
Burst '   # gk: maximal K conductance; gl: leak'; Pause 800
HoverAt 14 32

# 3. .xppsettings.json entries take a description next to the colour
Key '^2' 400; Key '^{HOME}' 100; Key '{DOWN}' 100; Key '{END}' 300
Burst "`n        `"gsyn`": {`n            `"color`": `"#7ee787`",`n            `"description`": `"coupling to the mean voltage (mS/cm^2)`"`n        }"; Pause 1500
HoverAt 18 35 3500

# 4. array members: a list key and a member key above the array; the hover shows every level
ClickEnd 17
Burst "`n# vm[2,4]: the pair compared in aux pair"; Pause 900
Burst "`n# vm4: the slowest cell"; Pause 1000
HoverAt 22 20 4000

# 5. vm2 described twice at the same level: the earlier one is flagged, the quick fix removes it
ClickEnd 19
Burst "`n# vm[1..2]: excitatory cells"; Pause 1800
HoverAt 18 5 3500
Click; Key '^.' 1200; Key '{ENTER}' 1800
HoverAt 23 11 3500
