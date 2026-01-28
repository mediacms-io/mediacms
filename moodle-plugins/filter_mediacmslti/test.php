<?php
echo "Test 1: PHP works<br>";

echo "Testing path: " . __DIR__ . '<br>';

// Try the path with 4 parent dirs (current version)
if (file_exists(__DIR__ . '/../../../../config.php')) {
    echo "Found with ../../../../<br>";
    require_once(__DIR__ . '/../../../../config.php');
}
// Try with 2 parent dirs (correct for filter location)
else if (file_exists(__DIR__ . '/../../config.php')) {
    echo "Found with ../../<br>";
    require_once(__DIR__ . '/../../config.php');
}
else {
    die("Cannot find config.php. Tried: <br>" .
        __DIR__ . '/../../../../config.php<br>' .
        __DIR__ . '/../../config.php');
}

echo "Test 2: Moodle config loaded<br>";

echo "Test 3: Moodle loaded successfully<br>";
echo "wwwroot: " . $CFG->wwwroot . "<br>";

try {
    require_login();
    echo "Test 4: User logged in: " . $USER->id . "<br>";
} catch (Exception $e) {
    die("Login error: " . $e->getMessage());
}

echo "Test 5: All OK!";
