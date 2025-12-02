from pathlib import Path

path = Path('styles.css')
text = path.read_text(encoding='utf-8')

bad_block = "@media (max-width: 600px) {`n    .form-navigation {`n        flex-direction: row;`n        align-items: center;`n        justify-content: space-between;`n        gap: 12px;`n    }`n`n    .form-navigation .nav-button-group {`n        width: auto;`n        margin-left: auto;`n        justify-content: flex-end;`n    }`n`n    .radio-options {`n        gap: 12px;`n    }`n}\r\n\r\n    .form-navigation .radio-options {\r\n        gap: 12px;\r\n    }\r\n}\r\n"
replacement = "@media (max-width: 600px) {\n    .form-navigation {\n        flex-direction: row;\n        align-items: center;\n        justify-content: space-between;\n        gap: 12px;\n    }\n\n    .form-navigation .nav-button-group {\n        width: auto;\n        margin-left: auto;\n        justify-content: flex-end;\n    }\n\n    .radio-options {\n        gap: 12px;\n    }\n}\n\n"
if bad_block in text:
    text = text.replace(bad_block, replacement)
else:
    import sys
    sys.stderr.write('bad block not found\n')

anchor = '.form-navigation {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 16px;\n    width: 100%;\n}\n\n'
insert_block = '.form-navigation .nav-button-group {\n    display: flex;\n    gap: 12px;\n    margin-left: auto;\n}\n\n'
if insert_block not in text:
    text = text.replace(anchor, anchor + insert_block)

path.write_text(text, encoding='utf-8')
