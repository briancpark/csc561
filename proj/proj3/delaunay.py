import imageio
import numpy as np
from scipy.spatial import Delaunay
import json
import matplotlib.path as mplPath


def average_color(image, triangle):
    # Extract the vertices of the triangle
    vertices = triangle.reshape(-1, 2).astype(int)

    # Create a path for the triangle
    path = mplPath.Path(vertices)

    # Create a mask for the triangle in the image
    y, x = np.mgrid[: image.shape[0], : image.shape[1]]
    coordinates = np.column_stack((x.ravel(), y.ravel()))
    mask = path.contains_points(coordinates)
    mask = mask.reshape(image.shape[:2])

    # Get the colors of the triangle from the image using the mask
    triangle_colors = image[mask]

    avg_color = triangle_colors.mean(axis=0) / 255.0  # Normalize to [0,1]
    return avg_color.tolist()


def triangulate_image_to_json(image_path):
    image = imageio.imread(image_path)
    height, width, _ = image.shape

    # Create random points for triangulation
    num_points = 5000
    points = np.column_stack(
        (
            np.random.randint(0, width, num_points),
            np.random.randint(0, height, num_points),
        )
    )

    # Apply Delaunay triangulation
    tri = Delaunay(points)

    data = []
    for simplex in tri.simplices:
        triangle_points = points[simplex]

        # Compute average color for the triangle
        avg_color = average_color(image, triangle_points)

        triangle_points = np.append(triangle_points, [[0.75], [0.75], [0.75]], axis=1)
        # normalize x and y between -1, 1
        triangle_points[:, 0] = triangle_points[:, 0] / width * 3 - 1
        triangle_points[:, 1] = triangle_points[:, 1] / height * 3 - 1

        # flip axis
        triangle_points[:, 1] = triangle_points[:, 1] * -1

        # flip axis again on x
        triangle_points[:, 0] = triangle_points[:, 0] * -1

        # Create the JSON structure
        item = {
            "material": {
                "ambient": [0.1, 0.1, 0.1],
                "diffuse": avg_color,
                "specular": [0.3, 0.3, 0.3],
                "n": 5,
            },
            "vertices": triangle_points.tolist(),
            "normals": [[0, 0, -1] for _ in triangle_points],
            "triangles": [[0, 1, 2]],
        }
        data.append(item)

    return data


if __name__ == "__main__":
    img_path = "attributes/joever.jpg"  # Change this to your image path
    result = triangulate_image_to_json(img_path)

    with open("attributes/triangles3.json", "w") as outfile:
        json.dump(result, outfile)
